"""Generate fixed game assets without accounts/API keys.
Install edge-tts and gTTS into a temporary venv, then run this script.
Network synthesis happens here only; players receive local MP3 assets.
"""
import asyncio, hashlib, json, subprocess, tempfile
from pathlib import Path
import edge_tts
from gtts import gTTS
root=Path(__file__).resolve().parents[1]/'public/audio'
phrases=json.loads((root/'table-v1/manifest.json').read_text())['phrases']
phrases['chiu-win']='Chíu! Ù rồi!'
sem=asyncio.Semaphore(3)
manifest={k:{'provider':k,'phrases':phrases,'voices':{},'clips':{}} for k in ['edge','google']}
async def generate(provider,role,voice,name,text):
 out=root/f'table-{provider}-v1'/role;out.mkdir(parents=True,exist_ok=True)
 target=out/f'{name}.mp3'
 async with sem:
  with tempfile.TemporaryDirectory() as tmp:
   raw=Path(tmp)/'raw.mp3'
   for attempt in range(3):
    try:
     if provider=='edge':
      await asyncio.wait_for(edge_tts.Communicate(text,voice,rate='-25%' if name in ['win','chiu-win'] else '-10%').save(str(raw)),30)
     else:await asyncio.to_thread(lambda:gTTS(text,lang='vi',timeout=20).save(str(raw)))
     break
    except Exception:
     if attempt==2:raise
     await asyncio.sleep(1)
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-af','loudnorm=I=-19:TP=-2:LRA=7,afade=t=in:d=0.008','-ar','44100','-ac','1','-codec:a','libmp3lame','-b:a','128k',str(target)],check=True)
  duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(target)]))
  assert .2<duration<12,(target,duration)
  manifest[provider]['voices'][role]=voice
  manifest[provider]['clips'][role+'/'+name]={'duration':duration,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
  print(provider,role,name,round(duration,2),flush=True)
async def main():
 jobs=[]
 for p,r,v in [('edge','male','vi-VN-NamMinhNeural'),('edge','female','vi-VN-HoaiMyNeural'),('google','shared','vi')]:
  jobs.extend(generate(p,r,v,n,t) for n,t in phrases.items())
 await asyncio.gather(*jobs)
 for p,m in manifest.items():(root/f'table-{p}-v1/manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
asyncio.run(main())
