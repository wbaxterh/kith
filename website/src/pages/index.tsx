import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started">
            Get Started
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            style={{marginLeft: '1rem'}}
            to="/docs/tutorial">
            Tutorial (15 min)
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    title: 'Sentence-Aware TTS',
    description: 'No more mid-thought pauses. Kith chunks text at natural sentence boundaries so your companion sounds like a person, not a robot reading fragments.',
  },
  {
    title: 'Runtime Agnostic',
    description: 'Swap Pipecat for LiveKit without changing your companion code. Stable adapter contracts mean your voice logic is portable across runtimes.',
  },
  {
    title: 'Voice Character Profiles',
    description: 'Define your companion\'s voice personality in a single JSON file: TTS settings, slang, pronunciation, persona mode. Ship different characters with zero code changes.',
  },
  {
    title: 'Emoji-to-Emotion',
    description: 'Emojis in your agent\'s output automatically become emotion_state events. Your avatar reacts to the sentiment without any manual mapping.',
  },
  {
    title: 'Real Laughter',
    description: 'ElevenLabs v3 laugh tags turn "haha" and "lol" into actual laughter and giggles. Four default slang dicts ship out of the box.',
  },
  {
    title: 'Sits Beside Your Agent',
    description: 'Kith owns the voice loop. You keep your agent, your persona, your memory, your tools. No lock-in, no opinions on how you build your AI.',
  },
];

function Feature({title, description}: {title: string; description: string}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="padding-horiz--md padding-vert--lg">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Voice framework for AI companions"
      description="Kith is a runtime-agnostic voice framework for AI companions. Sentence-aware TTS, slang expansion, emoji-to-emotion, barge-in, and avatar events.">
      <HomepageHeader />
      <main>
        <section className="container margin-vert--xl">
          <div className="row">
            {features.map((props, idx) => (
              <Feature key={idx} {...props} />
            ))}
          </div>
        </section>
        <section className="container margin-vert--lg">
          <div className="text--center">
            <Heading as="h2">Install</Heading>
            <pre style={{display: 'inline-block', textAlign: 'left', padding: '1.5rem', borderRadius: '8px'}}>
              <code>bun add @kithjs/core @kithjs/runtime-pipecat @kithjs/voice-router</code>
            </pre>
          </div>
        </section>
      </main>
    </Layout>
  );
}
