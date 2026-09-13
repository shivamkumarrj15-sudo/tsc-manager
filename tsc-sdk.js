/**
 * TSC Pro — JavaScript SDK v1.0
 * ==============================
 * Kisi bhi website mein embed karo aur calculation API use karo.
 *
 * Usage:
 *   <script src="https://shivamkumarrj15-sudo.github.io/tsc-manager/tsc-sdk.js"></script>
 *   <script>
 *     const result = TSCProAPI.calculate(text, { apiKey: "TSC-WEB1-2024-A7X3" });
 *     console.log(result);
 *   </script>
 *
 * (c) TSC Pro — Authorized Use Only
 */
(function(global) {
    'use strict';

    // ============================================================
    //  VALID API KEYS
    //  Format: "KEY": { owner: "Name", rateStr: "90/10", active: true }
    // ============================================================
    const _API_KEYS = {
        "TSC-WEB1-2024-A7X3": { owner: "Website 1",  rateStr: "90/10", active: true },
        "TSC-AI01-2024-B9K2": { owner: "AI/Chatbot", rateStr: "90/10", active: true },
        "TSC-DEV1-2024-C4M8": { owner: "Developer",  rateStr: "90/10", active: true }
    };

    // Rate limiter: max 100 req/min per key
    const _rl = {};
    function _checkRL(key) {
        const now = Date.now();
        if (!_rl[key]) _rl[key] = { c: 0, r: now + 60000 };
        if (now > _rl[key].r) _rl[key] = { c: 0, r: now + 60000 };
        _rl[key].c++;
        return _rl[key].c <= 100;
    }

    const CATEGORIES_MAP = {
        fb:  ['fb','f.b','faridabad','fd','fs'],
        nfb: ['nfb','n.f.b','newfb','newfaridabad'],
        gb:  ['gb','g.b','ghaziabad','gzb','gd'],
        nd:  ['nd','n.d','gali'],
        pd:  ['pd','p.d','ds','d.s','desawar']
    };
    const CATEGORY_KEYS   = ['fb','nfb','gb','nd','pd'];
    const TRIPLE_NUMBERS  = ['111','222','333','444','555','666','777','888','999','000'];

    function _catByTime(ts) {
        if (!ts) return null;
        const m = ts.match(/(\d{1,2})[:.:](\d{2})[\s\u202F\u00A0]*([aApP][mM])?/);
        if (!m) return null;
        let h = +m[1], mn = +m[2];
        const ap = (m[3]||'').toLowerCase();
        if (ap==='pm' && h<12) h+=12;
        if (ap==='am' && h===12) h=0;
        const t = h*60+mn;
        if (t>360  && t<1105) return 'fb';
        if (t>=1105 && t<1165) return 'nfb';
        if (t>=1165 && t<1320) return 'gb';
        if (t>=1320 && t<1410) return 'nd';
        return 'pd';
    }

    function _parseRow(raw, inherited, time, remaining) {
        const entries = [];
        if (!raw || !raw.trim()) return entries;
        let row = raw.trim();
        let rt = time;
        const bm = row.match(/^\[?(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?[,\s]+([^\]]+)\]\s*(.*?):\s*(.*)$/);
        const pm = row.match(/^(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?[,\s]+([^\s-]+(?:\s*[aApP][mM])?)\s*-\s*[^:]+:\s*(.*)$/);
        if (bm) {
            const tm = bm[4].match(/(\d{1,2}[:.]\d{2}(?:[\s\u202F\u00A0]*[aApP][mM])?)/);
            if (tm && !rt) rt = tm[1];
            row = bm[6];
        } else if (pm) {
            if (!rt) rt = pm[4];
            row = pm[5];
        } else {
            row = row.replace(/^\[[^\]]+\]\s*[^:]+:\s*/,'').trim();
        }
        if (!row) return entries;

        let cat = null, alias = '';
        const s = row.toLowerCase().replace(/[\s\.\*#:,\-@"]/g,'');
        for (const k in CATEGORIES_MAP) {
            for (const a of CATEGORIES_MAP[k]) {
                if (s.includes(a.replace(/\./g,''))) { cat=k; alias=a; break; }
            }
            if (cat) break;
        }
        if (!cat) cat = _catByTime(rt);
        if (!cat && remaining) {
            for (const nl of remaining) {
                const ns = nl.toLowerCase().replace(/[\s\.\*#:,\-@"]/g,'');
                for (const k in CATEGORIES_MAP) {
                    for (const a of CATEGORIES_MAP[k]) {
                        if (ns.includes(a.replace(/\./g,''))) { cat=k; break; }
                    }
                    if (cat) break;
                }
                if (cat) break;
            }
        }
        if (!cat) cat = inherited;
        if (!cat) return entries;

        const isDbl = /\b(ab|abc)\b/i.test(row);
        let area = row;
        if (alias) area = area.replace(new RegExp(alias,'gi'),' ');
        area = area.replace(/[\[\{]/g,'(').replace(/[\}\]]/g,')').replace(/["']/g,' ').trim();
        const parts = area.split(/(\(\d+\))/).map(p=>p.trim()).filter(p=>p.length>0);

        for (let i=0; i<parts.length; i++) {
            const na = parts[i];
            if (na.startsWith('(') && na.endsWith(')')) continue;
            const bp = parts[i+1];
            let bv = 1;
            if (bp && bp.startsWith('(') && bp.endsWith(')')) { bv=parseInt(bp.slice(1,-1),10)||1; i++; }
            else if (remaining) {
                for (const nl of remaining) { const bm2=nl.match(/\((\d+)\)/); if(bm2){bv=parseInt(bm2[1],10)||1;break;} }
            }
            const nums = [];
            const rRx = /(\d{1,2})\s*[^\w\d]*to[^\w\d]*\s*(\d{1,2})/gi;
            let rm2;
            while ((rm2=rRx.exec(na))!==null) {
                const [,a,b] = rm2;
                const sa=parseInt(a,10),eb=parseInt(b,10);
                if (sa>=1&&eb<=100&&sa<=eb) for(let n=sa;n<=eb;n++) nums.push(String(n).padStart(2,'0'));
            }
            const stripped = na.replace(rRx,' ');
            for (const n of (stripped.match(/\b\d{1,3}\b/g)||[])) {
                const v=parseInt(n,10);
                if (n.length===2&&v>=0&&v<=99) nums.push(String(v).padStart(2,'0'));
                else if (n==='100'||v===100) nums.push('100');
                else if (n.length===3&&TRIPLE_NUMBERS.includes(n)) nums.push(n);
            }
            if (nums.length>0) entries.push({numbers:[...new Set(nums)],bracketValue:bv,category:cat,isDouble:isDbl});
        }
        return entries;
    }

    function _calc(text, rateStr) {
        const commVal = parseInt((rateStr||'90/10').split('/')[1],10)||10;
        const commPct = commVal/100;
        const res = {};
        for (const k of CATEGORY_KEYS) res[k]={total:0,passing:0,debit:0,credit:0,jodiCount:0,harufCount:0};
        const rows = text.split('\n').map(r=>r.trim()).filter(r=>r.length>0);
        let curCat = null;
        for (let i=0; i<rows.length; i++) {
            const rem = rows.slice(i+1);
            const ents = _parseRow(rows[i],curCat,null,rem);
            if (ents.length>0) curCat=ents[ents.length-1].category;
            for (const e of ents) {
                const c=e.category, mul=e.isDouble?2:1;
                let j=0,h=0;
                for (const n of e.numbers) {
                    if (n.length===2||n==='100') j++;
                    else if (n.length===3&&TRIPLE_NUMBERS.includes(n)) h++;
                }
                const tSale=(j+h)*e.bracketValue*mul;
                res[c].total    +=tSale;
                res[c].jodiCount+=j;
                res[c].harufCount+=h;
                res[c].passing  +=Math.round(tSale*0.90); // passing/debit always 90/10
                res[c].credit   +=tSale-Math.round(tSale*commPct);
            }
        }
        let gTotal=0,gPass=0,gDebit=0,gCredit=0;
        const breakdown={};
        for (const k of CATEGORY_KEYS) {
            const r=res[k];
            r.debit=r.passing;
            gTotal+=r.total; gPass+=r.passing; gDebit+=r.debit; gCredit+=r.credit;
            if (r.total>0) breakdown[k.toUpperCase()]={total:r.total,passing:r.passing,debit:r.debit,credit:r.credit,jodiCount:r.jodiCount,harufCount:r.harufCount};
        }
        return {success:true,rateUsed:rateStr||'90/10',grandTotal:gTotal,grandPassing:gPass,grandDebit:gDebit,grandCredit:gCredit,netBalance:gCredit-gDebit,breakdown};
    }

    // ============================================================
    //  PUBLIC API
    // ============================================================
    const TSCProAPI = {
        version: '1.0.0',
        name: 'TSC Pro SDK',

        calculate: function(text, options) {
            options = options || {};
            if (!options.apiKey) return {success:false,error:'API key required.',code:401};
            const kc = _API_KEYS[options.apiKey];
            if (!kc || !kc.active) return {success:false,error:'Invalid or inactive API key.',code:403};
            if (!_checkRL(options.apiKey)) return {success:false,error:'Rate limit exceeded (100/min).',code:429};
            if (!text || typeof text!=='string' || !text.trim()) return {success:false,error:'Input text required.',code:400};
            if (text.length>50000) return {success:false,error:'Input too large (max 50000 chars).',code:413};
            try {
                const r = _calc(text, options.rate||kc.rateStr||'90/10');
                r.apiOwner = kc.owner;
                r.timestamp = new Date().toISOString();
                return r;
            } catch(e) {
                return {success:false,error:'Calculation failed.',code:500};
            }
        },

        verifyKey: function(apiKey) {
            const k = _API_KEYS[apiKey];
            if (!k||!k.active) return {valid:false};
            return {valid:true,owner:k.owner,defaultRate:k.rateStr};
        },

        info: function() {
            return {name:TSCProAPI.name,version:TSCProAPI.version,website:'https://shivamkumarrj15-sudo.github.io/tsc-manager/',docs:'https://shivamkumarrj15-sudo.github.io/tsc-manager/api-demo.html'};
        }
    };

    if (typeof module!=='undefined'&&module.exports) module.exports=TSCProAPI;
    else global.TSCProAPI = TSCProAPI;

})(typeof window!=='undefined'?window:this);
