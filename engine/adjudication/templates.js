// Adjudication Templates — deterministic narration by material + action + outcome
// No LLM: templates are canon. Log entry + template = reproducible narration.

const TEMPLATES = {
  // WOOD
  wood: {
    break: {
      success: 'You wrench the wooden %name apart. Splinters spray everywhere.',
      mixed: 'You strike the %name, and it cracks, but holds.',
      failure: 'You try to break the %name, but it withstands the impact.'
    },
    examine: {
      success: 'The wooden %name is made of %detail.',
      mixed: 'The %name shows signs of age but is still intact.',
      failure: 'You cannot make out much about the %name.'
    },
    take: {
      success: 'You heft the wooden %name—surprisingly light.',
      mixed: 'You struggle to lift the %name, but manage.',
      failure: 'The %name is too heavy to lift.'
    },
    burn: {
      success: 'The wooden %name catches fire eagerly. Flames spread quickly.',
      mixed: 'The %name smolders but does not fully ignite.',
      failure: 'The %name resists the flames.'
    }
  },

  // STONE
  stone: {
    break: {
      success: 'You strike the stone %name. It cracks with a sharp report.',
      mixed: 'You strike the %name and crack its surface.',
      failure: 'You hit the %name, but it barely marks.'
    },
    examine: {
      success: 'The stone %name is solid and ancient.',
      mixed: 'The %name shows cracks and weathering.',
      failure: 'The stone %name is unremarkable.'
    },
    take: {
      success: 'You carry the stone %name with effort.',
      mixed: 'You struggle to move the heavy %name.',
      failure: 'The %name is immovable.'
    },
    burn: {
      success: 'The stone %name is unaffected by heat.',
      mixed: 'The %name heats but does not burn.',
      failure: 'The stone %name is impervious to flame.'
    }
  },

  // METAL
  metal: {
    break: {
      success: 'You strike the metal %name with a deafening clang. It warps.',
      mixed: 'Your blow rings against the %name, leaving a dent.',
      failure: 'You strike the %name, but it rings undamaged.'
    },
    examine: {
      success: 'The metal %name is crafted with care.',
      mixed: 'The %name shows rust and wear.',
      failure: 'The %name gleams faintly in the light.'
    },
    take: {
      success: 'You lift the metal %name, feeling its weight.',
      mixed: 'The %name is heavy, but you manage.',
      failure: 'The %name is far too heavy.'
    },
    burn: {
      success: 'The metal %name glows in the heat but does not burn.',
      mixed: 'The %name grows hot but holds its form.',
      failure: 'The metal %name is unaffected by fire.'
    }
  },

  // GLASS
  glass: {
    break: {
      success: 'The glass %name shatters into razor-sharp shards.',
      mixed: 'The %name cracks with a tinkling sound.',
      failure: 'You strike the %name, but it holds.'
    },
    examine: {
      success: 'The glass %name is delicate and precisely made.',
      mixed: 'The %name has hairline cracks but is intact.',
      failure: 'The %name is transparent and unremarkable.'
    },
    take: {
      success: 'You carefully take the delicate glass %name.',
      mixed: 'You lift the %name, wary of breaking it.',
      failure: 'The %name is too fragile to move safely.'
    },
    burn: {
      success: 'The glass %name glows but does not ignite.',
      mixed: 'The %name heats but is unharmed.',
      failure: 'Fire does not affect the glass %name.'
    }
  },

  // CLOTH
  cloth: {
    break: {
      success: 'The cloth %name tears easily in your hands.',
      mixed: 'You tear the %name, but it is durable.',
      failure: 'The %name resists tearing.'
    },
    examine: {
      success: 'The cloth %name is woven with care.',
      mixed: 'The %name shows wear and tears.',
      failure: 'The %name is plain cloth.'
    },
    take: {
      success: 'You bundle the cloth %name easily.',
      mixed: 'You gather the %name, which is cumbersome.',
      failure: 'The %name is tangled and difficult to move.'
    },
    burn: {
      success: 'The cloth %name catches fire instantly. Flames race along the fibers.',
      mixed: 'The %name smolders and begins to burn.',
      failure: 'The %name resists ignition.'
    }
  },

  // CERAMIC
  ceramic: {
    break: {
      success: 'The ceramic %name breaks into rough pieces.',
      mixed: 'You crack the %name, but it mostly holds.',
      failure: 'The %name is resilient and does not break.'
    },
    examine: {
      success: 'The ceramic %name is glazed and well-crafted.',
      mixed: 'The %name is chipped and worn.',
      failure: 'The %name is plain pottery.'
    },
    take: {
      success: 'You carefully take the ceramic %name.',
      mixed: 'You lift the %name, which is somewhat heavy.',
      failure: 'The %name is too heavy or fragile to move.'
    },
    burn: {
      success: 'The ceramic %name is unaffected by heat.',
      mixed: 'The %name heats but does not burn.',
      failure: 'Fire does not harm the ceramic %name.'
    }
  },

  // ORGANIC
  organic: {
    break: {
      success: 'The %name crumbles in your hands.',
      mixed: 'The %name partially crumbles.',
      failure: 'The %name is too tough to break easily.'
    },
    examine: {
      success: 'The %name is fresh and whole.',
      mixed: 'The %name is aging but still intact.',
      failure: 'The %name is in questionable condition.'
    },
    take: {
      success: 'You take the %name.',
      mixed: 'You take the %name, which is somewhat fragile.',
      failure: 'The %name falls apart as you try to move it.'
    },
    burn: {
      success: 'The %name catches fire eagerly, burning to ash.',
      mixed: 'The %name smolders and burns slowly.',
      failure: 'The %name resists burning.'
    }
  }
};

// Get a template, with fallback
export function getTemplate(material, action, outcome) {
  const mat = String(material || 'wood').toLowerCase();
  const act = String(action || 'examine').toLowerCase();
  const out = String(outcome || 'success').toLowerCase();

  const matTemplates = TEMPLATES[mat] || TEMPLATES.wood;
  const actionTemplates = matTemplates[act] || matTemplates.examine;
  const template = actionTemplates[out] || actionTemplates.success;

  return template;
}

// Interpolate template with object name and details
export function renderTemplate(template, objectName, details = {}) {
  let text = String(template || '');
  text = text.replace(/%name/g, String(objectName || 'object'));
  text = text.replace(/%detail/g, String(details.detail || 'sturdy wood'));
  return text;
}

// Get all templates for inspection/testing
export function getAllTemplates() {
  return TEMPLATES;
}

export const templates = {
  TEMPLATES,
  getTemplate,
  renderTemplate,
  getAllTemplates
};
