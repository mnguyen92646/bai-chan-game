"""Preserve approved v3 voices; slower win calls and a distinct Chíu/Ù boundary.
Run from any directory. Requires ffmpeg. Originals remain unchanged.
"""
import hashlib,json,subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'public/audio'
manifest={'version':1,'source':'table-v3','processing':'Pitch-preserving atempo=0.6 on win only; Chíu followed by 180ms pause and lengthened win. No voice/phoneme regeneration.','clips':{}}
def run(args):subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*args],check=True)
for voice in ['male','female']:
 out=root/'table-v4'/voice;out.mkdir(parents=True,exist_ok=True)
 src=root/'table-v3'/voice
 with tempfile.TemporaryDirectory() as tmp:
  wav=Path(tmp)/'win.wav'
  run(['-i',str(src/'win.mp3'),'-af','atempo=0.6,afade=t=in:d=0.008','-ar','44100','-ac','1',str(wav)])
  run(['-i',str(wav),'-codec:a','libmp3lame','-b:a','128k',str(out/'win.mp3')])
  run(['-i',str(src/'chiu.mp3'),'-i',str(wav),'-filter_complex','[0:a]apad=pad_dur=0.18[a];[a][1:a]concat=n=2:v=0:a=1[out]','-map','[out]','-codec:a','libmp3lame','-b:a','128k',str(out/'chiu-win.mp3')])
 for name in ['win','chiu-win']:
  f=out/(name+'.mp3');duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(f)]))
  manifest['clips'][voice+'/'+name]={'duration':duration,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'phrase':'Ù! Ù rồi!' if name=='win' else 'Chíu! Ù! Ù rồi!'}
  print(voice,name,round(duration,2))
(root/'table-v4/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
