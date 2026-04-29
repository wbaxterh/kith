import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

const features = [
  {
    icon: '🎙',
    title: 'Sentence-Aware TTS',
    description: 'Text is chunked at natural sentence boundaries. No more robotic mid-thought pauses or fragment-synthesized audio.',
  },
  {
    icon: '🔌',
    title: 'Runtime Agnostic',
    description: 'Stable adapter contracts let you swap Pipecat for LiveKit without touching your companion code. No vendor lock-in.',
  },
  {
    icon: '🎭',
    title: 'Voice Character Profiles',
    description: 'Define voice personality in a single JSON file — TTS settings, slang, pronunciation, persona mode. Ship different characters with zero code changes.',
  },
  {
    icon: '😊',
    title: 'Emoji-to-Emotion',
    description: 'Emojis in your agent\'s output become emotion_state events. Your avatar reacts to sentiment automatically.',
  },
  {
    icon: '😂',
    title: 'Real Laughter',
    description: 'ElevenLabs v3 audio tags turn "haha" and "lol" into actual laughter. Four default slang dicts ship out of the box.',
  },
  {
    icon: '🧩',
    title: 'Modular Plugin Architecture',
    description: 'Every capability is an npm package. Compose only what you need — core, voice router, observability, avatar events.',
  },
  {
    icon: '🛑',
    title: 'Barge-In Detection',
    description: 'Users can interrupt at any time. Kith stops in-flight TTS immediately and signals the turn change.',
  },
  {
    icon: '👁',
    title: 'Avatar Event Bus',
    description: 'Normalized viseme_frame and emotion_state events drive your avatar — VRM, Canvas, Unity, whatever renderer you use.',
  },
  {
    icon: '📊',
    title: 'Built-in Observability',
    description: 'Span tracing, duplicate-send guards, and reconnect metrics. Diagnose production voice failures without guessing.',
  },
];

const useCases = [
  'AI Companions', 'Virtual Tutors', 'Game NPCs', 'Customer Support Bots',
  'Therapy Companions', 'Language Learning', 'Virtual Influencers',
  'Accessibility Tools', 'Interactive Storytelling', 'Voice Assistants',
  'Social Platform Bots', 'Fitness Coaches', 'Meditation Guides',
  'Travel Companions', 'Creative Writing Partners',
];

const packages = [
  { name: '@kithjs/core', desc: 'Adapter contracts, event bus, policy hooks', href: 'https://www.npmjs.com/package/@kithjs/core' },
  { name: '@kithjs/runtime-pipecat', desc: 'Primary runtime — Pipecat Python sidecar', href: 'https://www.npmjs.com/package/@kithjs/runtime-pipecat' },
  { name: '@kithjs/runtime-livekit', desc: 'LiveKit adapter (WebRTC, mock mode in v0.1)', href: 'https://www.npmjs.com/package/@kithjs/runtime-livekit' },
  { name: '@kithjs/voice-router', desc: 'Sentence chunking, slang, pronunciation, emoji-to-emotion', href: 'https://www.npmjs.com/package/@kithjs/voice-router' },
  { name: '@kithjs/observability', desc: 'Traces, dup-send guards, reconnect metrics', href: 'https://www.npmjs.com/package/@kithjs/observability' },
  { name: '@kithjs/avatar-events', desc: 'Normalized avatar/expression events', href: 'https://www.npmjs.com/package/@kithjs/avatar-events' },
];

function HeroSection() {
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <h1 className={styles.heroTitle}>
          The Voice Layer for<br />AI Companions
        </h1>
        <p className={styles.heroSubtitle}>
          Kith is a runtime-agnostic voice framework that sits between your agent
          and realtime voice infrastructure. Ship companions that sound natural,
          handle barge-in, and drive avatars — without rebuilding the voice stack.
        </p>
        <div className={styles.buttons}>
          <Link className={styles.primaryBtn} to="/docs/getting-started">
            Get Started
          </Link>
          <Link className={styles.secondaryBtn} to="/docs/tutorial">
            Tutorial (15 min)
          </Link>
          <Link className={styles.secondaryBtn} href="https://github.com/wbaxterh/kith">
            GitHub
          </Link>
        </div>
        <div className={styles.installBar}>
          <code className={styles.installCode}>
            bun add @kithjs/core @kithjs/runtime-pipecat @kithjs/voice-router
          </code>
        </div>
      </div>
    </header>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.featuresSection}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Voice quality out of the box
        </Heading>
        <p className={styles.sectionSub}>
          Everything you need to make AI companions sound like people, not robots.
        </p>
        <div className="row">
          {features.map((f, idx) => (
            <div className="col col--4" key={idx} style={{marginBottom: '1.5rem'}}>
              <div className={styles.featureCard}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <div className={styles.featureTitle}>{f.title}</div>
                <div className={styles.featureDesc}>{f.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className={styles.archSection}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Sits beside your agent, not inside it
        </Heading>
        <p className={styles.sectionSub}>
          Kith owns the voice loop. You keep your agent, your persona, your memory, your tools.
        </p>
        <pre className={styles.archDiagram}>
{`your agent  ←→  @kithjs/core  ←→  runtime adapter  ←→  Pipecat | LiveKit
                     │
           voice router ─── slang, pronunciation, chunking
           observability ── traces, dup-send, reconnect
           avatar events ── viseme, emotion, turn state`}
        </pre>
      </div>
    </section>
  );
}

function UseCasesSection() {
  return (
    <section className={styles.useCasesSection}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Built for every companion use case
        </Heading>
        <p className={styles.sectionSub}>
          From gaming NPCs to therapy bots — if it talks, Kith makes it sound better.
        </p>
        <div className={styles.useCaseGrid}>
          {useCases.map((uc, idx) => (
            <span className={styles.useCaseTag} key={idx}>{uc}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PackagesSection() {
  return (
    <section className={styles.packagesSection}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Modular by design
        </Heading>
        <p className={styles.sectionSub}>
          Six npm packages. Compose only what you need.
        </p>
        <div className="row">
          <div className="col col--6 col--offset-3">
            {packages.map((pkg, idx) => (
              <a href={pkg.href} key={idx} style={{textDecoration: 'none'}}>
                <div className={styles.pkgCard}>
                  <div className={styles.pkgName}>{pkg.name}</div>
                  <div className={styles.pkgDesc}>{pkg.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const integrations = [
  { name: 'ElizaOS', desc: 'Multi-agent operating system', href: 'https://elizaos.ai' },
  { name: 'LangGraph', desc: 'Stateful agent orchestration', href: 'https://langchain-ai.github.io/langgraph/' },
  { name: 'Pipecat', desc: 'Realtime voice pipeline', href: 'https://github.com/pipecat-ai/pipecat' },
  { name: 'LiveKit', desc: 'WebRTC infrastructure', href: 'https://livekit.io' },
  { name: 'ElevenLabs', desc: 'Neural text-to-speech', href: 'https://elevenlabs.io' },
  { name: 'Custom Agents', desc: 'Your own orchestrator', href: '/docs/getting-started' },
];

function IntegrationsSection() {
  return (
    <section className={styles.featuresSection}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Works with the tools you already use
        </Heading>
        <p className={styles.sectionSub}>
          Kith is the voice layer — plug it into any agent framework or TTS provider.
        </p>
        <div className="row">
          {integrations.map((item, idx) => (
            <div className="col col--4" key={idx} style={{marginBottom: '1rem'}}>
              <a href={item.href} style={{textDecoration: 'none'}}>
                <div className={styles.featureCard}>
                  <div className={styles.featureTitle}>{item.name}</div>
                  <div className={styles.featureDesc}>{item.desc}</div>
                </div>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className={styles.ctaSection}>
      <div className="container">
        <Heading as="h2" className={styles.ctaTitle}>
          Give your companion a voice
        </Heading>
        <p className={styles.ctaDesc}>
          Open source. MIT licensed. Ship natural voice in under 15 minutes.
        </p>
        <div className={styles.buttons}>
          <Link className={styles.primaryBtn} to="/docs/getting-started">
            Read the Docs
          </Link>
          <Link className={styles.secondaryBtn} href="https://github.com/wbaxterh/kith">
            Star on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="The Voice Layer for AI Companions"
      description="Kith is a runtime-agnostic voice framework for AI companions. Sentence-aware TTS, slang expansion, emoji-to-emotion, barge-in, and avatar events. Open source, MIT licensed.">
      <HeroSection />
      <main>
        <FeaturesSection />
        <ArchitectureSection />
        <UseCasesSection />
        <PackagesSection />
        <IntegrationsSection />
        <CTASection />
      </main>
    </Layout>
  );
}
