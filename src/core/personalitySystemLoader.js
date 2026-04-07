// Personality System Loader — pure Node.js port (no React/Zustand)
import personalityData from './personality-system/traits.json' with { type: 'json' };

const { categories } = personalityData;

const categoryMapping = {
  emotionalExpression: 'emotional_expression',
  socialEnergy: 'social_energy',
  thinkingStyle: 'thinking_style',
  humorPersonality: 'humor_edge',
  coreValues: 'core_values',
  howTheyCare: 'how_they_care',
  energyPresence: 'energy_presence',
  lifestyleInterests: 'lifestyle_interests'
};

const categoryLabels = {
  emotionalExpression: 'Emotional Expression',
  socialEnergy: 'Social Energy',
  thinkingStyle: 'Thinking Style',
  humorPersonality: 'Humor & Edge',
  coreValues: 'Core Values',
  howTheyCare: 'How They Care',
  energyPresence: 'Energy & Presence',
  lifestyleInterests: 'Lifestyle & Interests'
};

export function getCharacterTraitDefinitions(characterTraits) {
  if (!characterTraits) return {};
  const traitDefinitions = {};

  for (const [propName, categoryKey] of Object.entries(categoryMapping)) {
    const selectedTraits = characterTraits[propName];
    if (!selectedTraits || selectedTraits.length === 0) continue;

    const categoryTraits = categories[categoryKey];
    if (!categoryTraits) continue;

    const matched = selectedTraits
      .map(traitName => {
        const traitDef = categoryTraits[traitName];
        return traitDef ? { name: traitName, ...traitDef } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.priority - a.priority);

    if (matched.length > 0) {
      traitDefinitions[propName] = { traits: matched };
    }
  }
  return traitDefinitions;
}

export function buildPersonalityGuidance(traitDefinitions) {
  if (!traitDefinitions || Object.keys(traitDefinitions).length === 0) return '';

  let guidance = '';

  for (const [propName, data] of Object.entries(traitDefinitions)) {
    const label = categoryLabels[propName] || propName;
    guidance += `${label}:\n`;

    for (const trait of data.traits) {
      guidance += `• ${trait.name} — speak with ${trait.discourse.toLowerCase()}; ${trait.conduct.toLowerCase()}\n`;
    }
    guidance += `\n`;
  }

  return guidance.trim();
}
