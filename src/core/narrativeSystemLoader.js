// Narrative System Loader — pure Node.js port (no React/Zustand)
import narrativeData from './narrative-system/styles.json' with { type: 'json' };

const { styles } = narrativeData;

const styleLabels = {
  companion: 'Companion/Chat',
  omniscient: 'Omniscient Narrator',
  third_person_limited: 'Third-person Limited',
  first_person: 'First-person Narrator',
  second_person: 'Second-person Narrator',
  cinematic: 'Cinematic Style',
  literary: 'Literary Prose'
};

export function getNarrativeOptions() {
  const options = [{ value: '', label: 'None' }];
  for (const key of Object.keys(styles)) {
    options.push({ value: key, label: styleLabels[key] || key });
  }
  return options;
}

export function getNarrativeStyle(styleKey) {
  if (!styleKey) return null;
  const style = styles[styleKey];
  if (!style) return null;
  return { ...style, label: styleLabels[styleKey] || styleKey };
}
