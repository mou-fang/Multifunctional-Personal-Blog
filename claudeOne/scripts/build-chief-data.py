"""Build Sheik Mainland catalogue from pinned public product facts, entirely offline.

No paint reflectance, K/S coefficients or real-world precision are invented.
Product photographs are referenced by URL/hash and are not redistributed.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'libs/paint-data-20261008'
SOURCE = BASE / 'sheik-mainland/source-records.json'

ZH = str.maketrans({'啞':'哑','紅':'红','綠':'绿','藍':'蓝','黃':'黄','淺':'浅','膚':'肤','裝':'装','鋼':'钢','彈':'弹','機':'机','殼':'壳','經':'经','櫻':'樱','軍':'军','屬':'属','銅':'铜','銀':'银','鐵':'铁','隕':'陨','薰':'薰','獨':'独','髒':'脏','氣':'气','奢':'奢','華':'华','龍':'龙','骯':'肮','骸':'骸','螢':'荧','補':'补','紗':'纱','檸':'柠','楓':'枫','橫':'横','橢':'椭','穹':'穹','紋':'纹','藥':'药','塗':'涂','葉':'叶','復':'复','貴':'贵','樂':'乐','幹':'干','凜':'凛','燄':'焰','棟':'栋','靈':'灵','勞':'劳','攝':'摄','紮':'扎','騷':'骚','鵬':'鹏','瑪':'玛','棕':'棕','蓋':'盖','剛':'刚','臍':'脐','風':'风','極':'极','發':'发','襯':'衬','緋':'绯','倫':'伦','爾':'尔','蘭':'兰','烏':'乌','孫':'孙','輝':'辉','燦':'灿','滅':'灭','澤':'泽','動':'动','戶':'户','間':'间','衛':'卫','獵':'猎','變':'变','堅':'坚','淚':'泪','義':'义','絕':'绝','體':'体','愛':'爱','燒':'烧'})

ZH.update(str.maketrans({'純':'纯','閃':'闪','寶':'宝','軟':'软','絲':'丝','漢':'汉'}))

RANGES = {
    'bt-solid':'BT 笔涂纯色', 'btsy':'BTSY 色之源', 'sm-solid':'SM 喷涂纯色',
    'bt-metallic':'BT 金属色', 'sm-metallic':'SM 金属色', 'fluorescent':'BTYG 荧光色',
    'transparent':'BT 透明色', 'primer':'BT 补土', 'topcoat':'BT 保护漆',
    'pearlescent':'BT 珠光色', 'sparkling':'BTYJ 闪金色', 'wash':'SX 渗线色',
}

def build():
    value = json.loads(SOURCE.read_text(encoding='utf-8'))
    paints = []
    for r in value['records']:
        cat = r['category']; ref = r['reference']; label = r['name'].translate(ZH)
        ordinary = cat in ['bt-solid','btsy','sm-solid']
        p = {'id':'sheik-mainland-'+r['code'].lower(), 'code':r['code'], 'name':r['name'], 'label':label,
             'brand':'酋长大陆', 'range':RANGES[cat], 'type':'opaque' if ordinary else 'transparent' if cat=='transparent' else 'fluorescent' if cat=='fluorescent' else 'technical',
             'binder':'acrylic', 'delivery':'airbrush' if cat.startswith('sm-') else 'brush',
             'hex':ref['hex'], 'referenceBasis':ref['basis'], 'sourceKey':r['sourceKey'],
             'aliases':'Sheik Mainland SM 酋長大陸 德森派乐 '+r.get('alternateName','')}
        if cat in ['bt-metallic','sm-metallic','pearlescent','sparkling']: p['metallic']=True
        if ordinary: p['mixingGroup']='sheik-mainland-airbrush' if cat=='sm-solid' else 'sheik-mainland-brush'
        if ref.get('image'): p['referenceURL']=ref['image']
        paints.append(p)
    assert len({p['id'] for p in paints})==len(paints)
    catalogue_file = BASE / 'catalogue.json'
    catalogue = json.loads(catalogue_file.read_text(encoding='utf-8'))
    catalogue['paints']=[p for p in catalogue['paints'] if p['brand']!='酋长大陆']+paints
    catalogue['sources']=value['sources']
    catalogue_file.write_text(json.dumps(catalogue,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
    chief = {'version':1,'brand':'酋长大陆','sources':value['sources'],'paints':paints}
    (SOURCE.parent/'catalogue.json').write_text(json.dumps(chief,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
    manifest={str(p.relative_to(BASE)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(BASE.rglob('*')) if p.is_file() and p.name not in ['manifest.json','README.md'] and '__pycache__' not in str(p)}
    (BASE/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(f'Built {len(paints)} Sheik Mainland records, {sum(p["type"]=="opaque" and p["hex"] is not None for p in paints)} reference colours; {len(catalogue["paints"])} catalogue records in total.')

if __name__=='__main__': build()
