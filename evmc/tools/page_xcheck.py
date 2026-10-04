"""Recoupe une page exportée avec les tables du run, et son moteur de backtest avec une
réimplémentation indépendante. Usage, depuis la racine du dépôt :
    python3 tools/page_xcheck.py runs/<run_id> tools/page_core_run.js data/<barres>.csv
"""
import sys, re, json, base64, subprocess, numpy as np, pyarrow.parquet as pq
run=sys.argv[1]
html=open(run+'/report/dashboard.html',encoding='utf8').read()
D=json.loads(re.search(r'<script type="application/json" id="evmc-data">(.*?)</script>',html,re.S).group(1))
f64=lambda s: np.frombuffer(base64.b64decode(s),dtype='<f8'); i16=lambda s: np.frombuffer(base64.b64decode(s),dtype='<i2'); u16=lambda s: np.frombuffer(base64.b64decode(s),dtype='<u2')
RS=D['fc']['ret_scale']
B=D['bars']; o,h,l,c,ts=[f64(B[k]) for k in ('open','high','low','close','ts')]
G=D['grid']; NH=len(G); OR=D['fc']['origins']; E=D['split']['eval_start']; n=B['n']
print('barres exportées',n,'= début du holdout',D['split']['holdout_start'],'| origines',len(OR),'| pas',D['fc']['stride'])
# 1. données exportées contre les tables du run
fc=pq.read_table(run+'/forecasts.parquet').to_pandas()
csv=np.loadtxt(sys.argv[3],delimiter=',',skiprows=1)
assert np.array_equal(c, csv[:n,4]) and np.array_equal(o, csv[:n,1]) and np.array_equal(h, csv[:n,2])
bad=0
for mid,blk in D['fc']['models'].items():
    q=i16(blk['q']).reshape(len(OR),NH,5)*RS; p=u16(blk['p']).reshape(len(OR),NH)/65535
    sub=fc[fc.model_id==mid].sort_values(['bar_idx','horizon'])
    ref=sub[['q0500','q2500','q5000','q7500','q9500']].values.reshape(len(OR),NH,5)
    # quantification : un demi-point de base sur les quantiles, 1/131070 sur les probabilités
    bad+=int(np.abs(q-np.clip(ref,-3.2768,3.2767)).max()>0.5*RS+1e-12); bad+=int(np.abs(p-sub.raw_p_up.values.reshape(len(OR),NH)).max()>0.5/65535+1e-12)
    assert list(sub.bar_idx.values[::NH])==OR
print('modèles exportés',list(D['fc']['models']),'| blocs en désaccord avec forecasts.parquet :',bad)
me=pq.read_table(run+'/metrics.parquet').to_pandas(); dev=me[(me.scope=='dev')&(me.model_id!='_outcomes')]
MX=D['metrics']; ids=[m['id'] for m in D['models']]
assert len(MX['v'])==len(dev)
import random; random.seed(1); bad=0
key={(r.model_id, r.baseline_id if isinstance(r.baseline_id,str) else None, r.horizon, r.metric, r.point_kind if isinstance(r.point_kind,str) else None):r for r in dev.itertuples()}
for i in random.sample(range(len(MX['v'])),1500):
    k=(ids[MX['m'][i]], ids[MX['b'][i]] if MX['b'][i]>=0 else None, G[MX['h'][i]], MX['names'][MX['k'][i]], MX['pk'][MX['p'][i]] if MX['p'][i]>=0 else None)
    r=key[k]; ok=abs(MX['v'][i]-r.value)<=1e-6*max(1e-12,abs(r.value))
    if MX['lo'][i] is not None: ok&=abs(MX['lo'][i]-r.ci_lo)<=1e-6*max(1e-12,abs(r.ci_lo))
    bad+=not ok
print('métriques exportées',len(MX['v']),'| échantillon de 1500 en désaccord avec metrics.parquet :',bad)
# 2. banc d'essai : réimplémentation indépendante
def bt(P):
    H=G[P['g']]; cost=P['cost']/1e4; p=u16(D['fc']['models'][P['model']]['p']).reshape(len(OR),NH)[:,P['g']]/65535
    sig={b:float(v) for b,v in zip(OR,p)}
    eq=[]; equity=1.0; trades=[]; i=E; pos=None
    while i<n:
        if pos is None and i>E and (i-1) in sig:
            pu=sig[i-1]; d=0
            if P['dir']!='short' and pu>=P['theta']: d=1
            elif P['dir']!='long' and pu<=1-P['theta']: d=-1
            if d: pos=dict(t=i-1,e=i,d=d,entry=o[i],eq0=equity*(1-cost))
        if pos:
            d=pos['d']; en=pos['entry']; ex=None
            sl=en*(1-d*P['sl']/100) if P['sl']>0 else None; tp=en*(1+d*P['tp']/100) if P['tp']>0 else None
            if d>0:
                if sl is not None and l[i]<=sl: ex=min(o[i],sl)
                elif tp is not None and h[i]>=tp: ex=max(o[i],tp)
            else:
                if sl is not None and h[i]>=sl: ex=max(o[i],sl)
                elif tp is not None and l[i]<=tp: ex=min(o[i],tp)
            if ex is None and (i>=pos['t']+H or i==n-1): ex=c[i]
            if ex is not None:
                g=max(-1.0,d*(ex/en-1)); equity=pos['eq0']*(1+g)*(1-cost); trades.append(dict(e=pos['e'],x=i,d=d,gross=g,net=(1-cost)**2*(1+g)-1)); pos=None; eq.append(equity)
            else: eq.append(pos['eq0']*(1+max(-1.0,d*(c[i]/en-1))))
        else: eq.append(equity)
        i+=1
    eq=np.array(eq); peak=np.maximum.accumulate(np.maximum(eq,1)); dd=(eq/peak-1).min()
    r=np.diff(np.concatenate([[1],eq]))/np.concatenate([[1],eq[:-1]])
    bpy=(n-1)/((ts[-1]-ts[0])/(365.25*86400e3))
    nets=np.array([t['net'] for t in trades])
    return dict(n=len(trades),net=eq[-1]-1,asset=c[n-1]/c[E]-1,maxDD=dd,sharpe=r.mean()/r.std(ddof=1)*np.sqrt(bpy) if r.std()>0 else None,
                winRate=(nets>0).mean() if len(nets) else None, pf=(nets[nets>0].sum()/-nets[nets<=0].sum()) if (nets<=0).any() and nets[nets<=0].sum()<0 else None,
                exposure=sum(t['x']-t['e']+1 for t in trades)/len(eq), avg=nets.mean() if len(nets) else None)
sets=[dict(model='b2_clim',g=G.index(20),theta=0.52,dir='long',tp=0,sl=0,cost=5),
      dict(model='b5_drift',g=G.index(60),theta=0.55,dir='both',tp=8,sl=4,cost=10),
      dict(model='b2_clim',g=G.index(5),theta=0.51,dir='short',tp=0,sl=3,cost=0),
      dict(model='b7_garch_fhs',g=G.index(1),theta=0.50,dir='both',tp=1,sl=1,cost=2)]
js=json.loads(subprocess.run(['node',sys.argv[2],run+'/report/dashboard.html',json.dumps(sets)],capture_output=True,text=True,check=True).stdout)
for P,j in zip(sets,js):
    py=bt(P); st=j['stats']; ok=True
    for k in ('n','net','asset','maxDD','sharpe','winRate','pf','exposure','avg'):
        a,b=py[k],st[k]
        if a is None or b is None: ok&=(a is None and b is None)
        else: ok&=abs(a-b)<=1e-9*max(1,abs(a))
    print(P['model'],'H',G[P['g']],P['dir'],'θ',P['theta'],'| trades',py['n'],'net %.4f'%py['net'],'dd %.4f'%py['maxDD'],'| JS = Python :',ok)

# 3. chemins typiques exportés contre legacy_paths.parquet
if D.get('legacy'):
    X=D['legacy']; H=X['h']; lp=pq.read_table(run+'/legacy_paths.parquet').to_pandas()
    typ=i16(X['typ']).reshape(len(OR),H)*X['ret_scale']; bb=i16(X['bb']).reshape(len(OR),H)*X['ret_scale']; sg=u16(X['sig']).reshape(len(OR),H)*X['ret_scale']
    wu=np.frombuffer(base64.b64decode(X['wu']),dtype='u1').reshape(len(OR),H)*X['wick_scale']
    e1=np.abs(typ-lp.typical.values.reshape(len(OR),H)).max(); e2=np.abs(bb-lp.backbone.values.reshape(len(OR),H)).max(); e3=np.abs(sg-lp.sigma_path.values.reshape(len(OR),H)).max()
    e4=np.abs(wu-np.minimum(lp.wick_up.values.reshape(len(OR),H),0.255)).max()
    print('chemins exportés : écart max typique %.1e, squelette %.1e, sigma %.1e, mèches %.1e (quantification : 5e-05 et 5e-04)'%(e1,e2,e3,e4))
    assert max(e1,e2,e3)<=0.5*X['ret_scale']+1e-12 and e4<=0.5*X['wick_scale']+1e-12
    st=pq.read_table(run+'/legacy_state.parquet').to_pandas()
    assert list(st.dir_regime.values)==X['state']['dir'] and np.allclose(st.final_r.values,np.array(X['state']['final_r'],float),rtol=1e-4,atol=1e-9)
    pm=pq.read_table(run+'/path_metrics.parquet').to_pandas(); d=pm[pm.scope=='dev']; bad=0
    for key,arr in list(X['pm']['v'].items())[::7]:
        metric,model,sl=key.split('|'); ref=d[(d.metric==metric)&(d.model_id==model)&(d.slice==sl)].set_index('step').value
        for k,v in enumerate(arr):
            if v is None: bad+=int((k+1) in ref.index); continue
            bad+=int(abs(v-ref.loc[k+1])>1e-4*max(1e-9,abs(ref.loc[k+1]))+1e-12)
    print('mesures par pas exportées : séries contrôlées',len(list(X['pm']['v'].items())[::7]),'| valeurs en désaccord :',bad)
