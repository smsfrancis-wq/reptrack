/* RepTrack v2: local-first Supabase sync. Changes never overwrite divergent cloud versions automatically. */
(function () {
  'use strict';
  const PROJECT_URL = 'https://mcbzabueipossapkkoil.supabase.co';
  const KEY = 'reptrack.cloud.v2';
  const keyPattern = /^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+)$/;
  const defaults = () => ({publishableKey:'', userId:null, revision:null, dirty:false});
  let config;
  try { config = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { config = defaults(); }
  let client = null, user = null, hooks = null, status = 'local', message = '';
  let conflict = null, inFlight = false, timer = null, booted = false;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function persist() { try { localStorage.setItem(KEY,JSON.stringify(config)); } catch (_) {} }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+stable(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  function emptyStarter(v) {
    return v && Array.isArray(v.workouts) && v.workouts.length === 0 && v.creatine.length === 0 &&
      v.bodyWeights.length === 1 && Number(v.bodyWeights[0].lbs) === 208 &&
      v.bodyWeights[0].note === 'Starting weight';
  }
  function setStatus(next, detail) {
    status = next; message = detail || '';
    if (hooks) hooks.redraw();
  }
  function makeClient() {
    if (!config.publishableKey) return false;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      setStatus('error','Supabase library unavailable. Tracking still works offline; reconnect to the internet.');
      return false;
    }
    client = window.supabase.createClient(PROJECT_URL,config.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'reptrack-auth-v2'}
    });
    client.auth.onAuthStateChange((event,session)=>{
      const prior = user && user.id;
      user = session && session.user || null;
      if (prior && user && prior !== user.id) {
        config.userId=null;config.revision=null;config.dirty=false;persist();
      }
      if(event==='SIGNED_OUT') { user=null;setStatus('signed-out','Signed out. Your local records remain on this device.'); }
      else if(event==='SIGNED_IN' && user && booted) {
        setStatus('ready','Signed in. Checking cloud records.'); queueSync(100);
      }
    });
    return true;
  }
  function queueSync(delay=1400) {
    clearTimeout(timer);
    if (!client || !user || conflict) return;
    timer = setTimeout(()=>syncNow(),delay);
  }
  async function writeRecord(snapshot, expected) {
    const result = await client.rpc('reptrack_write',{p_data:snapshot,p_revision:expected});
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    const revision = Number(row && row.new_revision);
    if (!Number.isSafeInteger(revision) || revision < 1) throw Error('Cloud did not confirm the revision.');
    return revision;
  }
  function acceptCloud(payload,revision) {
    if (!hooks.validData(payload)) throw Error('Cloud backup format is invalid; local data has not changed.');
    hooks.replaceState(payload);
    config.revision=Number(revision);config.userId=user.id;config.dirty=false;persist();
    conflict=null;setStatus('synced','Cloud records downloaded.');
  }
  function showConflict(payload,revision) {
    conflict={payload,revision:Number(revision)};
    setStatus('conflict','The cloud and this device contain different records. Neither copy has been overwritten.');
  }
  async function syncNow() {
    if (inFlight || conflict || !client || !user || !hooks) return;
    if(navigator.onLine===false) {setStatus('offline','Offline. Changes remain on this device.');return;}
    inFlight=true;setStatus('syncing','Checking for updates…');
    try {
      const {data:remote,error}=await client.from('reptrack_data').select('payload,revision')
        .eq('user_id',user.id).maybeSingle();
      if (error) throw error;
      const local=hooks.getState();
      if (!remote) {
        if (!emptyStarter(local) && config.userId!==user.id &&
            !confirm('This Supabase account has no cloud backup. Upload this device’s existing RepTrack records to it?')) {
          setStatus('ready','No data uploaded. Select Sync now to retry, or sign out.');return;
        }
        const sent=stable(local),newRev=await writeRecord(local,0);
        config.userId=user.id;config.revision=newRev;config.dirty=stable(hooks.getState())!==sent;
        persist();setStatus('synced','Cloud record created.');
        if(config.dirty) queueSync(700);
      } else if (config.userId!==user.id || config.revision===null) {
        if (emptyStarter(local) || stable(local)===stable(remote.payload)) acceptCloud(remote.payload,remote.revision);
        else showConflict(remote.payload,remote.revision);
      } else if (Number(config.revision)!==Number(remote.revision)) {
        if (config.dirty) showConflict(remote.payload,remote.revision);
        else acceptCloud(remote.payload,remote.revision);
      } else if (config.dirty) {
        const sent=stable(local),newRev=await writeRecord(local,Number(remote.revision));
        config.revision=newRev;config.dirty=stable(hooks.getState())!==sent;
        persist();setStatus('synced','Changes uploaded.');
        if(config.dirty) queueSync(700);
      } else setStatus('synced','Cloud and device are up to date.');
    } catch (e) {
      const detail=String(e && (e.message || e.details) || e);
      setStatus('error',detail.includes('SYNC_CONFLICT')
        ? 'Another device changed the cloud during upload. Press Sync now to review.'
        : detail);
    } finally {inFlight=false;}
  }
  async function resumeSession() {
    if (!client) return;
    try {
      const {data,error}=await client.auth.getSession();
      if (error) throw error;
      user = data.session && data.session.user || null;
      if(user) {setStatus('ready','Signed in. Checking cloud records.');queueSync(50);}
      else setStatus('signed-out','Sign in or create an account.');
    } catch(e) {setStatus('error',e.message||String(e));}
  }
  async function configure(key) {
    key=key.trim();
    if(!keyPattern.test(key)) {
      setStatus('error','Enter an sb_publishable_ key or legacy anon JWT; never a secret/service_role key.');return;
    }
    config.publishableKey=key;config.userId=null;config.revision=null;config.dirty=false;persist();
    if(!makeClient())return;
    booted=true;await resumeSession();
  }
  async function authenticate(email,password,createAccount) {
    if (!client) return;
    setStatus('syncing',createAccount?'Creating account…':'Signing in…');
    try {
      const {data,error}=createAccount
        ? await client.auth.signUp({email,password})
        : await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      user=data && data.session && data.user || null;
      if(user) {setStatus('ready','Authenticated. Checking cloud records.');queueSync(100);}
      else setStatus('signed-out','Account created. Confirm your email if Supabase requests it, then sign in.');
    } catch(e) {setStatus('error',e.message||String(e));}
  }
  async function signOut() {
    clearTimeout(timer);
    if(config.dirty && !confirm('Some changes may not be uploaded. Sign out anyway?'))return;
    if(client) {
      const {error}=await client.auth.signOut();
      if(error){setStatus('error',error.message);return;}
    }
    user=null;conflict=null;config.userId=null;config.revision=null;config.dirty=false;persist();
    setStatus('signed-out','Signed out. Data remains locally on this device.');
  }
  async function resolveConflict(useCloud) {
    if(!conflict || !user)return;
    if(useCloud) {
      if(!confirm('Replace this device’s records with the cloud copy? A local backup will download first.'))return;
      hooks.downloadLocal();
      try {acceptCloud(conflict.payload,conflict.revision);}
      catch(e) {setStatus('error',e.message||String(e));}
      return;
    }
    if(!confirm('Replace the cloud copy with this device’s records? Consider preserving a cloud backup before continuing.'))return;
    inFlight=true;setStatus('syncing','Uploading device records…');
    try {
      const snapshot=hooks.getState(), sent=stable(snapshot);
      const revision=await writeRecord(snapshot,conflict.revision);
      config.userId=user.id;config.revision=revision;config.dirty=stable(hooks.getState())!==sent;
      persist();conflict=null;setStatus('synced','Device records uploaded.');
      if(config.dirty)queueSync(900);
    } catch(e) {setStatus('error',e.message||String(e));}
    finally {inFlight=false;}
  }
  function badge() {
    if(!config.publishableKey)return '● LOCAL ONLY';
    if(!user)return '● CLOUD NOT SIGNED IN';
    if(status==='conflict')return '● SYNC CONFLICT';
    if(status==='synced'&&!config.dirty)return '● CLOUD SYNCED';
    if(status==='syncing')return '● SYNCING';
    if(status==='error')return '● SYNC NEEDS ATTENTION';
    return '● OFFLINE / PENDING';
  }
  function panel() {
    const head='<section class="card section-spacer"><div class="card-hd"><h2>Cloud synchronisation</h2><span class="pill">'+esc(status.toUpperCase())+'</span></div>';
    const detail='<p class="muted tiny">Supabase project: '+esc(PROJECT_URL)+'. Only enter a publishable key, never a secret or service_role key.</p>';
    const note=message?'<p class="tiny" role="status" style="margin-top:12px">'+esc(message)+'</p>':'';
    if(!config.publishableKey)return head+detail+'<form class="stack" data-cloud-form="key" style="margin-top:16px"><div class="field"><label for="cloud-key">Publishable / anon key</label><input id="cloud-key" name="key" type="text" autocomplete="off" placeholder="sb_publishable_…" required></div><button class="btn primary" type="submit">Connect Supabase</button></form>'+note+'</section>';
    if(!user)return head+detail+'<form class="stack" data-cloud-form="auth" style="margin-top:16px"><div class="field"><label for="cloud-email">Email</label><input id="cloud-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="cloud-password">Password</label><input id="cloud-password" name="password" type="password" autocomplete="current-password" minlength="6" required></div><div class="flex wrap"><button class="btn primary" type="submit" data-cloud-auth="signin">Sign in</button><button class="btn" type="submit" data-cloud-auth="signup">Create account</button></div></form><div style="margin-top:12px"><button class="btn ghost sm" data-cloud-action="change-key">Change key</button></div>'+note+'</section>';
    const signed='<p class="muted tiny">Signed in as '+esc(user.email||user.id)+'. Workouts are always saved locally first, then synchronised when online.</p>';
    let controls;
    if(conflict)controls='<p class="muted tiny" style="margin-top:12px">Cloud and local records differ. They cannot be merged automatically; export backups before selecting which version to keep.</p><div class="flex wrap" style="margin-top:12px"><button class="btn" data-cloud-action="backup">Back up this device</button><button class="btn primary" data-cloud-action="use-cloud">Use cloud version</button><button class="btn danger" data-cloud-action="use-device">Use this device</button></div>';
    else controls='<div class="flex wrap" style="margin-top:14px"><button class="btn primary" data-cloud-action="sync" '+(inFlight?'disabled':'')+'>Sync now</button><button class="btn ghost" data-cloud-action="signout">Sign out</button></div>';
    return head+signed+note+controls+'</section>';
  }
  function markDirty() {config.dirty=true;persist();queueSync();}
  function start(api) {
    hooks=api;booted=true;
    if(config.publishableKey && makeClient())resumeSession();
    else if(!config.publishableKey)setStatus('local','Enter the publishable key to enable sync.');
    window.addEventListener('online',()=>queueSync(500));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueSync(500);});
  }
  document.addEventListener('submit',async e=>{
    const form=e.target;
    if(!form || !form.dataset.cloudForm)return;
    e.preventDefault();
    const data=new FormData(form);
    if(form.dataset.cloudForm==='key')await configure(String(data.get('key')||''));
    else if(form.dataset.cloudForm==='auth')await authenticate(
      String(data.get('email')||'').trim(),String(data.get('password')||''),
      (e.submitter && e.submitter.dataset.cloudAuth)==='signup'
    );
  });
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-cloud-action]');if(!button)return;
    const action=button.dataset.cloudAction;
    if(action==='sync')await syncNow();
    else if(action==='signout')await signOut();
    else if(action==='backup')hooks.downloadLocal();
    else if(action==='use-cloud')await resolveConflict(true);
    else if(action==='use-device')await resolveConflict(false);
    else if(action==='change-key') {
      if(!confirm('Change the key? You will need to sign in again. Any unsynced changes will remain locally but may need manual conflict resolution.'))return;
      if(client)await client.auth.signOut();
      client=null;user=null;conflict=null;
      config.publishableKey='';config.userId=null;config.revision=null;config.dirty=false;persist();
      setStatus('local','Enter the publishable key from the Supabase dashboard.');
    }
  });
  window.RepTrackCloud={start,markDirty,panel,badge,syncNow};
})();
