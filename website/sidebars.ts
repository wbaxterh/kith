import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    'tutorial',
    {
      type: 'category',
      label: 'Concepts',
      items: ['concepts/architecture', 'concepts/event-bus', 'concepts/voice-characters'],
    },
    {
      type: 'category',
      label: 'Packages',
      items: [
        'packages/core',
        'packages/runtime-pipecat',
        'packages/runtime-livekit',
        'packages/voice-router',
        'packages/observability',
        'packages/avatar-events',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: ['guides/kaori-case-study', 'guides/custom-transforms', 'guides/deployment'],
    },
    'roadmap',
  ],
};

export default sidebars;
