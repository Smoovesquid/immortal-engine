// Field crafting recipes — P-71, rung two of docs/SALVAGE_AND_BUILD.md.
// Data module (JSON-shaped, no logic), validated by engine/craft/registry.js.
//
// The check gates QUALITY, not possibility: anyone can lash a torch together;
// hands that know the work make a better one. `tool` is a substring matched
// against carried tool strings (background gear) — having the right kit is
// worth +2 on the check. DC+5 = fine work (bonus output). Time always passes.

export default [
  {
    id: 'torch',
    name: 'Torch',
    aliases: ['torches'],
    output: { defRef: 'torch', qty: 2, fineQty: 3 },
    inputs: [
      { defRef: 'board', qty: 1 },
      { defRef: 'cloth_scrap', qty: 1 }
    ],
    hours: 1,
    check: { skill: 'Survival', dc: 8, tool: 'tinderbox' }
  },
  {
    id: 'sharpened-stake',
    name: 'Sharpened Stake',
    aliases: ['stake', 'stakes', 'spike'],
    output: { defRef: 'sharpened_stake', qty: 1, fineQty: 2 },
    inputs: [
      { defRef: 'board', qty: 1 }
    ],
    hours: 1,
    check: { skill: 'Survival', dc: 8, tool: 'knife' }
  },
  {
    id: 'splint',
    name: 'Splint',
    aliases: ['splints', 'field dressing', 'dressing', 'bandage'],
    output: { defRef: 'splint', qty: 1, fineQty: 2 },
    inputs: [
      { defRef: 'board', qty: 1 },
      { defRef: 'cloth_scrap', qty: 1 }
    ],
    hours: 1,
    check: { skill: 'Medicine', dc: 10, tool: 'herbalism kit' }
  },
  {
    id: 'cordage',
    name: 'Cordage',
    aliases: ['rope', 'cord', 'twine'],
    output: { defRef: 'cordage', qty: 1, fineQty: 2 },
    inputs: [
      { defRef: 'cloth_scrap', qty: 2 }
    ],
    hours: 1,
    check: { skill: 'Survival', dc: 5, tool: null }
  }
];
