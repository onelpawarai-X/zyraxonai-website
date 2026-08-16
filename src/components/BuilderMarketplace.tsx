import { useEffect, useState } from 'react';

function authToken() {
  try { const raw = localStorage.getItem('zyraxon_ecosystem_auth'); const data = raw ? JSON.parse(raw) : null; return typeof data?.token === 'string' ? data.token : ''; } catch { return ''; }
}

export default function BuilderMarketplace() {
  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    let timer = 0;
    const load = async () => { try { const r = await fetch('/api/public/builder/sites?limit=16'); const d = await r.json(); if (r.ok) setSites(Array.isArray(d.sites) ? d.sites : []); } catch {} };
    load();
    const saveCurrent = async () => {
      const token = authToken(); if (!token) return;
      const iframe = document.querySelector<HTMLIFrameElement>('.preview-frame iframe');
      const html = iframe?.getAttribute('srcdoc') || '';
      if (!html || html.length < 40) return;
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || 'ZYRAXON website').replace(/<[^>]+>/g, '').trim().slice(0, 160);
      try {
        await fetch('/api/public/builder/sites', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title, description: 'Created with ZYRAXON AI Builder', files: { 'index.html': html }, preview_html: html, is_public: true }) });
        load();
      } catch {}
    };
    const observer = new MutationObserver(() => { window.clearTimeout(timer); timer = window.setTimeout(saveCurrent, 2200); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['srcdoc'] });
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, []);

  if (!sites.length) return null;
  return <section className="zyraxon-marketplace glass">
    <div className="market-head"><div><b>ZYRAXON Ecosystem</b><span>Websites created by the community</span></div><small>{sites.length} projects</small></div>
    <div className="market-grid">{sites.map(site => <a className="market-card" key={site.id} href={`/builder?site=${encodeURIComponent(site.id)}`}><div className="market-preview" dangerouslySetInnerHTML={{ __html: site.preview_html || '' }} /><div className="market-meta"><b>{site.title}</b><span>{site.description || 'Built with ZYRAXON AI'}</span></div></a>)}</div>
    <style>{`.zyraxon-marketplace{margin:0 14px 14px;border-radius:22px;padding:14px 16px;position:relative;z-index:10}.market-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.market-head b{display:block;font-size:12px}.market-head span{display:block;color:var(--muted);font-size:10px;margin-top:3px}.market-head small{color:var(--soft)}.market-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;max-height:210px;overflow:auto}.market-card{color:var(--text);text-decoration:none;border:1px solid var(--line);border-radius:15px;overflow:hidden;background:rgba(255,255,255,.035);transition:.2s}.market-card:hover{transform:translateY(-2px);border-color:var(--line2)}.market-preview{height:105px;background:#fff;overflow:hidden;pointer-events:none}.market-preview>*{transform:scale(.32);transform-origin:top left;width:312%;min-height:310px}.market-meta{padding:9px}.market-meta b{display:block;font-size:11px}.market-meta span{display:block;color:var(--soft);font-size:9px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`}</style>
  </section>;
}
