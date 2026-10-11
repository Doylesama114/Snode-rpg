import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { LeaveGuard } from "./features/characters/CharacterWorkspace.tsx";

const developmentDocument = "https://lcnnkviu5vj0.feishu.cn/wiki/S0Crw8VEIi7kWPkBIRqcs3xdn6b";

function Compass({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 3 41 13v22L24 45 7 35V13Z" stroke="currentColor" strokeWidth="1" />
      <path d="m24 10 4.5 9.5L38 24l-9.5 4.5L24 38l-4.5-9.5L10 24l9.5-4.5Z" stroke="currentColor" strokeWidth="1" />
      <path d="m24 14 3.2 6.8L34 24l-6.8 3.2L24 34l-3.2-6.8L14 24l6.8-3.2Z" fill="currentColor" />
      <circle cx="24" cy="24" r="2" fill="var(--color-background)" />
    </svg>
  );
}

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {diagonal ? <path d="M5 15 15 5M5 5h10v10" /> : <path d="M3 10h13m-5-5 5 5-5 5" />}
    </svg>
  );
}

function SceneOrbit() {
  return (
    <svg className="scene-orbit" viewBox="0 0 640 640" fill="none" aria-hidden="true">
      <circle cx="320" cy="320" r="278" />
      <circle cx="320" cy="320" r="258" strokeDasharray="1 12" />
      <path d="M320 24v36m0 520v36M24 320h36m520 0h36M111 111l25 25m368 368 25 25M111 529l25-25m368-368 25-25" />
      <path d="m320 42 5 10-5 10-5-10Zm278 278-10 5-10-5 10-5ZM320 598l-5-10 5-10 5 10ZM42 320l10-5 10 5-10 5Z" />
    </svg>
  );
}

const foundations = [
  { number: "01", label: "CHARACTER", title: "属于你的角色", description: "从第一次建卡到每一次成长，留住角色的选择、能力与经历。" },
  { number: "02", label: "COMPANIONS", title: "一起走过的旅程", description: "与团员和 DM 共享冒险记录，让下一次相聚，从上一次的故事继续。" },
  { number: "03", label: "BELONGINGS", title: "冒险留下的收获", description: "金币、装备与每一次交易，都成为旅途中有迹可循的一部分。" },
];

function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">跳转到正文</a>
      <header className="site-header page-width">
        <a className="wordmark" href="#" aria-label="Snode 首页"><Compass /><span>Snode<span className="brand-period">.</span></span></a>
        <nav aria-label="主导航">
          <a href="#world">关于斯诺德</a>
          <a href="#/characters">角色档案</a>
          <a href={developmentDocument} target="_blank" rel="noreferrer">一期计划</a>
        </nav>
        <span className="preview-label">首页预览 <span>·</span> 一期建设中</span>
        <a className="header-link" href={developmentDocument} target="_blank" rel="noreferrer">开发文档<Arrow diagonal /></a>
      </header>

      <main id="main">
        <section className="hero page-width" aria-labelledby="hero-title">
          <div className="hero-scene" aria-hidden="true">
            <SceneOrbit />
            <div className="scene-image" />
            <div className="scene-vignette" />
            <div className="scene-frame"><span /><span /><span /><span /></div>
            <div className="scene-topline"><span>SNODE / WORLD EXPLORATION</span><span>Ⅰ</span></div>
            <div className="scene-caption"><span className="scene-caption-line" /><div><span>THE WORLD AWAITS</span><p>每一段旅程，都有新的可能。</p></div></div>
          </div>
          <div className="hero-content">
            <p className="eyebrow"><span className="eyebrow-rule" />FOR THE STORIES WE SHARE</p>
            <h1 id="hero-title">让每个角色，<br />都有<span>自己的故事。</span></h1>
            <p className="hero-translation" lang="en">Every character. A world within.</p>
            <p className="hero-description">为角色留一份档案，为伙伴留一段旅程。<br />从一张角色卡开始，把冒险写进斯诺德。</p>
            <div className="hero-actions">
              <a className="button-primary" href={developmentDocument} target="_blank" rel="noreferrer"><span>查看一期计划</span><Arrow diagonal /></a>
              <a className="text-link" href="#world">认识斯诺德<span aria-hidden="true">↓</span></a>
            </div>
            <p className="compact-preview">首页预览 · 一期建设中</p>
          </div>
          <div className="hero-bottom">
            <p><span className="small-star" aria-hidden="true">✧</span>让工具承担记录，让玩家专注冒险。</p>
            <a className="scroll-cue" href="#world" aria-label="继续向下，了解斯诺德"><span>继续向下</span><span className="scroll-cue-line" aria-hidden="true" /></a>
          </div>
        </section>

        <section className="world-section page-width" id="world" aria-labelledby="world-title">
          <div className="section-topline"><p className="eyebrow">01 <span className="eyebrow-rule" /> BEYOND THE CHARACTER SHEET</p><span>斯诺德 · 第一个篇章</span></div>
          <div className="world-heading">
            <h2 id="world-title">冒险会散场，<span>故事可以继续。</span></h2>
            <p>一期从角色开始，逐步连接团内协作与基础经济。<br />让记录有归处，也让下一次相聚更轻松。</p>
          </div>
          <div className="foundations">
            {foundations.map((item) => (
              <article className="foundation" key={item.number}>
                <div className="foundation-topline"><span className="foundation-number">{item.number}</span><span>{item.label}</span><span className="foundation-mark" aria-hidden="true">✧</span></div>
                <h3>{item.title}</h3><p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <a className="footer-brand" href="#">Snode<span className="brand-period">.</span><span className="footer-chinese">斯诺德</span></a>
        <p lang="en">A place for the stories we share.</p>
        <a href={developmentDocument} target="_blank" rel="noreferrer">一起书写下一章<Arrow diagonal /></a>
      </footer>
    </>
  );
}

const CharacterWorkspace = lazy(() => import("./features/characters/CharacterWorkspace.tsx"));

export default function App() {
  const [characters, setCharacters] = useState(() => location.hash === "#/characters");
  const guard = useRef<LeaveGuard | null>(null);
  const registerGuard = useCallback((value: LeaveGuard | null) => { guard.current = value; }, []);
  const navigate = useCallback((hash: string) => {
    const apply = () => {
      history.replaceState(null, "", hash);
      setCharacters(hash === "#/characters");
      if (hash === "#") window.scrollTo({ top: 0 });
    };
    if (guard.current && hash !== "#/characters") guard.current(apply);
    else apply();
  }, []);
  useEffect(() => {
    const changed = () => {
      const hash = location.hash || "#";
      if (guard.current && hash !== "#/characters") {
        history.replaceState(null, "", "#/characters");
        navigate(hash);
      } else setCharacters(hash === "#/characters");
    };
    window.addEventListener("hashchange", changed);
    return () => { window.removeEventListener("hashchange", changed); };
  }, [navigate]);
  if (!characters) return <HomePage />;
  return <Suspense fallback={<main className="page-width"><p role="status">正在打开角色档案…</p></main>}>
    <CharacterWorkspace onExit={() => navigate("#")} registerGuard={registerGuard} />
  </Suspense>;
}
