/* Character creation API for the local CLI. It runs in the same renderer as the
 * creation wizard, so all catalog data and the final save use the page's rules. */
(function () {
  'use strict';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function plainText(html) {
    var el = document.createElement('div');
    el.innerHTML = html || '';
    return (el.innerText || el.textContent || '').trim();
  }
  function findByName(rows, name) {
    return (rows || []).find(function (row) { return row.name === name || row.n === name; });
  }
  function listKeys(prefix) {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(prefix) === 0) keys.push(key);
    }
    return keys.sort();
  }
  function apply(spec) {
    applyCreationSnapshotToChar(spec || {});
    if (CHAR.raceName === '龙裔' && CHAR.dragonType) {
      var dragon = findByName(DRAGON_TYPES, CHAR.dragonType);
      if (dragon) {
        CHAR.dragonBreath = dragon.breath;
        CHAR.dragonResistance = dragon.resistance;
      }
    }
    return CHAR;
  }

  function flow() {
    return {
      version: 1,
      steps: STEP_LABELS.map(function (label, index) { return { index: index, label: label }; }),
      fields: {
        class: ['className', 'keyAttr', 'specChoices', 'deity', 'patron', 'contractCreature', 'weaponSpec'],
        features: ['selectedFeatures', 'bpPicks'],
        race: ['raceName', 'raceSize', 'dragonType', 'raceExtra', 'raceSaves', 'raceSkillChoice', 'raceProfInput', 'humanFreeSkill', 'wingfolkHasCommon'],
        attributes: ['attrs'],
        proficiencies: ['selectedSkills'],
        background: ['bgName', 'bgProfs', 'extraLanguages', 'bgCantrips', 'bgOtherPicks', 'sportPreference', 'contacts', 'scamType', 'missionChannel', 'academicDomain', 'crime', 'seclusion', 'militaryRole', 'foreignOrigin', 'companion'],
        equipment: ['equipLetter', 'equipSel'],
        review: ['charName', 'playerName', 'gender', 'age', 'height', 'weight', 'eye', 'skin', 'hair', 'story', 'personality', 'traits', 'ideals', 'bonds', 'flaws', 'aspiration']
      },
      catalogTypes: ['classes', 'races', 'backgrounds', 'features', 'equipment', 'proficiencies', 'classSkills', 'deities', 'patrons', 'contracts', 'dragonTypes', 'languages', 'cantrips', 'instruments', 'gambling', 'sports', 'advancements'],
      source: '斯诺德跑团/角色创建页.html'
    };
  }

  function catalog(type, className) {
    var maps = {
      classes: CLASSES, races: RACES, backgrounds: BACKGROUNDS,
      features: className ? (CLASS_STARTING_FEATURES[className] || []) : CLASS_STARTING_FEATURES,
      equipment: className ? (EQUIP_DATA[className] || []) : EQUIP_DATA,
      proficiencies: className ? {
        description: (findByName(CLASSES, className) || {})['技巧'] || '',
        options: typeof getClassSkillOptionInfo === 'function' ? getClassSkillOptionInfo(findByName(CLASSES, className)).options : parseSkills((findByName(CLASSES, className) || {})['技巧'] || ''),
        categories: SKILL_CATS
      } : SKILL_CATS,
      deities: CLERIC_DEITIES, patrons: WARLOCK_PATRONS,
      contracts: typeof CONTRACT_CREATURES === 'undefined' ? [] : CONTRACT_CREATURES,
      dragonTypes: DRAGON_TYPES,
      languages: typeof ALL_LANGUAGES === 'undefined' ? [] : ALL_LANGUAGES,
      cantrips: BG_MAGE_CANTRIPS, instruments: BG_INSTRUMENTS,
      gambling: BG_GAMBLING, sports: BG_SPORTS,
      advancements: window.CHARGEN_ADV_PATHS || {}
    };
    if (!Object.prototype.hasOwnProperty.call(maps, type)) throw new Error('未知目录类型：' + type);
    var data = maps[type];
    var entries = Array.isArray(data) ? data.map(function (row) {
      var label = typeof row === 'string' ? row : (row.name || row.n || row.letter || String(row));
      return { id: (className ? className + ':' : '') + label, label: label };
    }) : Object.keys(data || {}).map(function (key) { return { id: key, label: key }; });
    return { type: type, className: className || null, entries: entries, data: clone(data), source: '斯诺德跑团/角色创建页.html' };
  }

  function show(type, name) {
    var item, result = { type: type, name: name };
    if (type === 'class') {
      item = findByName(CLASSES, name);
      if (!item) throw new Error('未知职业：' + name);
      result.data = clone(item);
      result.detailText = plainText(classDetail(item));
      result.startingFeatures = clone(CLASS_STARTING_FEATURES[name] || []);
      result.specializations = clone(CLASS_SPECIALIZATIONS[name] || []);
      result.specializationChoices = clone(SPEC_PROF_CHOICES[name] || {});
      result.equipment = clone(EQUIP_DATA[name] || []);
      result.advancementPaths = clone((window.CHARGEN_ADV_PATHS || {})[name] || []);
      result.previewPages = [ovClassPageUrl(name, false), ovClassPageUrl(name, true)];
    } else if (type === 'race') {
      item = findByName(RACES, name);
      if (!item) throw new Error('未知种族：' + name);
      result.data = clone(item);
      result.detailText = plainText(raceDetail(item));
      result.languages = clone(RACE_LANGS[name] || []);
      result.dragonTypes = name === '龙裔' ? clone(DRAGON_TYPES) : [];
    } else if (type === 'background') {
      item = findByName(BACKGROUNDS, name);
      if (!item) throw new Error('未知背景：' + name);
      result.data = clone(item);
      result.detailText = plainText(bgDetail(item));
      result.cantrips = name === '法师学徒' ? clone(BG_MAGE_CANTRIPS) : [];
      result.otherPick = parseBgOtherPick(item);
      result.personalityChoices = clone(typeof BG_PERSONALITY === 'undefined' ? {} : (BG_PERSONALITY[name] || {}));
    } else if (type === 'feature') {
      var parts = name.split(':');
      item = findByName(CLASS_STARTING_FEATURES[parts[0]] || [], parts.slice(1).join(':'));
      if (!item) throw new Error('未知起始特性：' + name + '（格式：职业:特性）');
      result.data = clone(item);
      if (item.n === '基础材料学') result.blueprintChoices = clone(QIXIE_START_BLUEPRINTS);
    } else {
      throw new Error('show 支持 class、race、background、feature');
    }
    result.source = '斯诺德跑团/角色创建页.html';
    return result;
  }

  function rules(topic) {
    var data = {
      pointBuy: {
        totalPoints: TOTAL_POINTS, attributes: ATTR_NAMES,
        minimum: 8, maximumBeforeRace: 15, maximumCostPerAttribute: 9,
        costs: Array.from({ length: 8 }, function (_, i) { var value = i + 8; return { value: value, cost: calcAttrCost(value), modifier: calcMod(value) }; }),
        raceBonusAppliedAfterPurchase: true
      },
      startingFeatures: { defaultPick: 2, magePick: 4, sorcererAndSummoner: '获得全部起始特性', artificerBlueprintPick: 2 },
      proficiencies: { classPick: 4, categories: SKILL_CATS },
      equipment: { data: EQUIP_DATA },
      sources: ['斯诺德跑团/角色创建页.html', '斯诺德跑团/资料库/creation_flow_data.js']
    };
    if (!topic || topic === 'all') return clone(data);
    if (!Object.prototype.hasOwnProperty.call(data, topic)) throw new Error('未知规则主题：' + topic);
    return clone(data[topic]);
  }

  function options(spec, step) {
    apply(spec);
    var index = Number(step);
    if (!Number.isInteger(index) || index < 0 || index >= TOTAL_STEPS) throw new Error('步骤须为 0–7');
    var current = clone(buildCreationSnapshot());
    CURRENT_STEP = index;
    renderStep(index);
    var area = document.getElementById('stepContent');
    var extras = {};
    if (index === 0 && CHAR.className) {
      extras.specializations = clone(CLASS_SPECIALIZATIONS[CHAR.className] || []);
      extras.specializationChoices = clone(SPEC_PROF_CHOICES[CHAR.className] || {});
      extras.deities = CHAR.className === '牧师' ? clone(CLERIC_DEITIES) : [];
      extras.patrons = CHAR.className === '魔契师' ? clone(WARLOCK_PATRONS) : [];
      extras.contracts = CHAR.className === '召唤师' && typeof CONTRACT_CREATURES !== 'undefined' ? clone(CONTRACT_CREATURES) : [];
      if (CHAR.className === '召唤师') showSummonerContractChoice(CHAR.className);
    }
    if (index === 1) extras.blueprintChoices = CHAR.selectedFeatures.indexOf('基础材料学') >= 0 ? clone(QIXIE_START_BLUEPRINTS) : [];
    if (index === 2 && CHAR.raceName) {
      showRaceAttrChoice(CHAR.raceData);
      showHumanFreeSkill(CHAR.raceData);
      showRaceSizePicker(CHAR.raceData);
      showDragonTypeChoice(CHAR.raceData);
      showRaceSaveChoice(CHAR.raceData);
      showRaceSkillChoice(CHAR.raceData);
      showRaceProfInput(CHAR.raceData);
      extras.race = clone(CHAR.raceData);
      extras.languages = clone(RACE_LANGS[CHAR.raceName] || []);
      extras.dragonTypes = CHAR.raceName === '龙裔' ? clone(DRAGON_TYPES) : [];
      extras.proficiencyCategories = clone(SKILL_CATS);
      extras.conditionalText = Array.from(document.querySelectorAll('#raceChoiceArea,#humanSkillArea,#raceSizeArea,#dragonTypeArea,#raceSaveArea,#raceSkillArea,#raceProfArea')).map(function (node) { return (node.innerText || node.textContent || '').trim(); });
    }
    if (index === 3) extras.pointBuy = rules('pointBuy');
    if (index === 4 && CHAR.className) extras.proficiencies = catalog('proficiencies', CHAR.className).data;
    if (index === 5 && CHAR.bgName) {
      extras.background = clone(CHAR.bgData);
      extras.personalityChoices = clone(typeof BG_PERSONALITY === 'undefined' ? {} : (BG_PERSONALITY[CHAR.bgName] || {}));
      extras.languageCount = parseBgLangCount(CHAR.bgData);
      extras.cantrips = CHAR.bgName === '法师学徒' ? clone(BG_MAGE_CANTRIPS) : [];
      extras.otherPick = parseBgOtherPick(CHAR.bgData);
      extras.instruments = clone(BG_INSTRUMENTS);
      extras.gambling = clone(BG_GAMBLING);
      extras.sports = clone(BG_SPORTS);
      renderBgProfs(CHAR.bgData);
      extras.proficiencyText = (document.getElementById('bgProfArea') || {}).textContent || '';
    }
    if (index === 6 && CHAR.className) extras.equipment = clone(EQUIP_DATA[CHAR.className] || []);
    if (index === 7) extras.advancementPaths = clone((window.CHARGEN_ADV_PATHS || {})[CHAR.className] || []);
    return {
      step: index, label: STEP_LABELS[index], current: current,
      renderedText: (area.innerText || area.textContent || '').trim(), renderedHtml: area.innerHTML,
      canContinue: !(area.querySelector('#nextBtn, #saveBtn') || {}).disabled,
      extras: extras
    };
  }

  function preview(spec) {
    apply(spec);
    CURRENT_STEP = TOTAL_STEPS - 1;
    renderReviewStep(document.getElementById('stepContent'));
    updateOverview();
    var area = document.getElementById('stepContent');
    var overview = document.getElementById('charOverview');
    return {
      reviewText: (area.innerText || area.textContent || '').trim(), reviewHtml: area.innerHTML,
      overviewText: overview ? (overview.innerText || overview.textContent || '').trim() : '',
      overviewHtml: overview ? overview.innerHTML : '',
      state: clone(buildCreationSnapshot())
    };
  }

  function preflight() {
    var errors = [];
    if (!findByName(CLASSES, CHAR.className)) errors.push('请选择有效职业');
    if (!findByName(RACES, CHAR.raceName)) errors.push('请选择有效种族');
    if (!findByName(BACKGROUNDS, CHAR.bgName)) errors.push('请选择有效背景');
    if (!CHAR.charName || !String(CHAR.charName).trim()) errors.push('请填写角色名');
    var spent = 0;
    ATTR_NAMES.forEach(function (attr) {
      var value = CHAR.attrs[attr];
      if (!Number.isInteger(value) || value < 8 || value > 15) errors.push(attr + '须为 8–15 的整数');
      else spent += calcAttrCost(value);
    });
    if (spent !== TOTAL_POINTS) errors.push('购点须恰好使用 ' + TOTAL_POINTS + ' 点，当前为 ' + spent);
    if (CHAR.classData) {
      var featurePool = CLASS_STARTING_FEATURES[CHAR.className] || [];
      var required = CHAR.className === '法师' ? 4 : (CHAR.className === '术士' || CHAR.className === '召唤师' ? featurePool.length : 2);
      var validFeatures = featurePool.map(function (row) { return row.n; });
      if (CHAR.selectedFeatures.length !== required) errors.push('起始特性需选 ' + required + ' 项');
      if (new Set(CHAR.selectedFeatures).size !== CHAR.selectedFeatures.length || CHAR.selectedFeatures.some(function (name) { return validFeatures.indexOf(name) < 0; })) errors.push('起始特性含重复或无效项');
      if (CHAR.selectedFeatures.indexOf('基础材料学') >= 0) {
        if (CHAR.bpPicks.length !== QIXIE_START_BP_PICK || new Set(CHAR.bpPicks).size !== CHAR.bpPicks.length || CHAR.bpPicks.some(function (name) { return QIXIE_START_BLUEPRINTS.indexOf(name) < 0; })) errors.push('基础材料学需从四张图纸中选择两张');
      }
      if (typeof classSkillPicksComplete === 'function' && !classSkillPicksComplete(CHAR.selectedSkills, CHAR.classData)) errors.push('职业熟练项选择不完整');
      if (typeof filterValidClassSkillPicks === 'function' && filterValidClassSkillPicks(CHAR.selectedSkills, CHAR.classData).length !== CHAR.selectedSkills.length) errors.push('职业熟练项含无效项');
      var specs = CLASS_SPECIALIZATIONS[CHAR.className] || [];
      var choices = SPEC_PROF_CHOICES[CHAR.className] || {};
      var allowedSpecs = specs.map(function (spec) { return spec.n; });
      Object.keys(CHAR.specChoices || {}).forEach(function (name) {
        if (allowedSpecs.indexOf(name) < 0) errors.push('无效职业专长选择：' + name);
      });
      specs.forEach(function (spec) {
        var rule = choices[spec.n]; if (!rule) return;
        var choice = (CHAR.specChoices || {})[spec.n];
        if (rule.multi) {
          if (!choice || !Array.isArray(choice.skills) || choice.skills.length !== rule.multi) errors.push(spec.n + '需选 ' + rule.multi + ' 项熟练');
          else if (new Set(choice.skills).size !== choice.skills.length || choice.skills.some(function (name) { return rule.pick.indexOf(name) < 0; })) errors.push(spec.n + '含重复或无效熟练项');
        } else if (!choice || !choice.skill || (rule.attr && !choice.attr)) errors.push(spec.n + '的熟练选择未完成');
        else if (rule.attr && (rule.attr.indexOf(choice.attr) < 0 || (rule.skills[choice.attr] || []).indexOf(choice.skill) < 0)) errors.push(spec.n + '选择了无效属性或熟练项');
        else if (rule.single && rule.single.indexOf(choice.skill) < 0) errors.push(spec.n + '选择了无效熟练项');
      });
      if (CHAR.weaponSpec && weaponSpecDefForClass(CHAR.className).cats.indexOf(CHAR.weaponSpec) < 0) errors.push('武器专精类别无效');
      if (CHAR.className === '召唤师' && (!CHAR.contractCreature || !findByName(typeof CONTRACT_CREATURES === 'undefined' ? [] : CONTRACT_CREATURES, CHAR.contractCreature.name))) errors.push('召唤师需选择有效契约生物');
      if (CHAR.className !== '召唤师' && CHAR.contractCreature) errors.push('当前职业不能选择契约生物');
      if (CHAR.className !== '魔契师' && CHAR.patron) errors.push('当前职业不能选择契约宗主');
      if (CHAR.className !== '牧师' && CHAR.bgName !== '侍僧' && CHAR.deity) errors.push('当前职业和背景不能选择神祇');
      var gear = EQUIP_DATA[CHAR.className] || [];
      if (equipDataIsMulti(gear)) {
        gear.forEach(function (group) {
          var selected = CHAR.equipSel && CHAR.equipSel[group.letter];
          if (!selected || !group.options[selected.opt] || group.options[selected.opt].text !== selected.text) errors.push('装备组 ' + group.letter + ' 未选择有效选项');
        });
      } else if (!CHAR.equipChoice || gear.indexOf(CHAR.equipChoice) < 0) errors.push('请选择有效起始装备');
    }
    if (CHAR.raceData) {
      var race = CHAR.raceData;
      var bonuses = race['属性加成'] || {};
      var flexible = Object.keys(bonuses).filter(function (attr) { return bonuses[attr] === 'X'; });
      if (flexible.length >= 2 && (CHAR.raceExtra.length !== 2 || new Set(CHAR.raceExtra).size !== 2 || CHAR.raceExtra.some(function (attr) { return flexible.indexOf(attr) < 0; }))) errors.push('种族额外属性须从允许项中选两项');
      if (!flexible.length && CHAR.raceExtra.length) errors.push('当前种族没有额外属性选择');
      var sizeText = race['体型'] || '';
      if (sizeText.indexOf('/') >= 0 || sizeText.indexOf('或') >= 0) {
        var sizeOptions = sizeText.split(/[\/或]/).map(function (value) { return value.trim(); }).filter(Boolean);
        if (sizeOptions.indexOf(CHAR.raceSize) < 0) errors.push('请选择有效种族体型');
      } else if (CHAR.raceSize && CHAR.raceSize !== sizeText) errors.push('当前种族体型选择无效');
      if (CHAR.raceName === '龙裔' && !findByName(DRAGON_TYPES, CHAR.dragonType)) errors.push('龙裔须选择有效龙种');
      if (CHAR.raceName !== '龙裔' && CHAR.dragonType) errors.push('当前种族不能选择龙种');
      var hasSaveChoice = false, hasSkillChoice = false, hasProfInput = false;
      (race['特性'] || []).forEach(function (trait) {
        if (trait.name === '中庸' && !CHAR.humanFreeSkill) errors.push('人类·中庸须选择自由熟练项');
        if (trait.save_choice) {
          hasSaveChoice = true;
          if (CHAR.raceSaves.length !== 1 || trait.save_choice.indexOf(CHAR.raceSaves[0]) < 0) errors.push(trait.name + '须选择有效豁免');
        }
        if (trait.skill_choice) {
          hasSkillChoice = true;
          var selected = Array.isArray(CHAR.raceSkillChoice) ? CHAR.raceSkillChoice : (CHAR.raceSkillChoice ? [CHAR.raceSkillChoice] : []);
          var needed = trait.grant_skill_points || 1;
          if (selected.length !== needed || new Set(selected).size !== selected.length || selected.some(function (name) { return trait.skill_choice.indexOf(name) < 0; })) errors.push(trait.name + '须选择 ' + needed + ' 项有效熟练度');
        }
        if (trait.prof_input) {
          hasProfInput = true;
          if (!CHAR.raceProfInput || CHAR.raceProfInput.length > 4) errors.push(trait.name + '须填写不超过四字的专业名');
        }
      });
      if (!hasSaveChoice && CHAR.raceSaves.length) errors.push('当前种族没有豁免选择');
      if (!hasSkillChoice && (Array.isArray(CHAR.raceSkillChoice) ? CHAR.raceSkillChoice.length : CHAR.raceSkillChoice)) errors.push('当前种族没有额外熟练选择');
      if (!hasProfInput && CHAR.raceProfInput) errors.push('当前种族没有自定义专业选择');
    }
    if (CHAR.bgData) {
      var languageCount = parseBgLangCount(CHAR.bgData);
      if (CHAR.extraLanguages.length !== languageCount || new Set(CHAR.extraLanguages).size !== CHAR.extraLanguages.length || CHAR.extraLanguages.some(function (language) { return ALL_LANGUAGES.indexOf(language) < 0; })) errors.push('背景须选择 ' + languageCount + ' 门有效额外语言');
      var other = parseBgOtherPick(CHAR.bgData);
      if (other) {
        var pool = other.kind === 'instrument' ? BG_INSTRUMENTS : BG_GAMBLING;
        if (CHAR.bgOtherPicks.length !== other.count || new Set(CHAR.bgOtherPicks).size !== CHAR.bgOtherPicks.length || CHAR.bgOtherPicks.some(function (name) { return pool.indexOf(name) < 0; })) errors.push('背景须选择 ' + other.count + ' 项有效' + other.label);
      } else if (CHAR.bgOtherPicks.length) errors.push('当前背景没有乐器或赌具选择');
      if (CHAR.bgName === '法师学徒' && (CHAR.bgCantrips.length !== 2 || new Set(CHAR.bgCantrips).size !== 2 || CHAR.bgCantrips.some(function (name) { return !findByName(BG_MAGE_CANTRIPS, name); }))) errors.push('法师学徒须选择两项有效戏法');
      if (CHAR.bgName !== '法师学徒' && CHAR.bgCantrips.length) errors.push('当前背景没有额外戏法选择');
      if (CHAR.bgName === '运动员' && BG_SPORTS.indexOf(CHAR.sportPreference) < 0) errors.push('运动员须选择有效偏好运动');
      if (CHAR.bgName !== '运动员' && CHAR.sportPreference) errors.push('当前背景没有偏好运动选择');
    }
    return errors;
  }

  function save(spec) {
    apply(spec);
    var errors = preflight();
    if (errors.length) return { ok: false, errors: errors };
    var originalAlert = window.SD_alert;
    var messages = [];
    window.SD_alert = function (message) { messages.push(String(message)); };
    var before = listKeys('char_');
    try { saveCharacter(); }
    finally { window.SD_alert = originalAlert; }
    var added = listKeys('char_').filter(function (key) { return before.indexOf(key) < 0; });
    var key = added[0];
    if (!key) return { ok: false, errors: messages.length ? messages : ['角色未保存；请检查创建选项'], messages: messages };
    return { ok: true, id: key.slice(5, -6), slot: 1, key: key, character: JSON.parse(localStorage.getItem(key)), messages: messages };
  }

  function characters(action, id, slot, value) {
    var key = id ? 'char_' + id + '_slot' + (slot || 1) : '';
    if (action === 'list') {
      var grouped = Object.create(null);
      listKeys('char_').forEach(function (k) {
        var match = /^char_(.*)_slot([123])$/.exec(k);
        if (!match) return;
        var data = JSON.parse(localStorage.getItem(k));
        var charId = match[1];
        if (!grouped[charId]) grouped[charId] = { id: charId, name: data.name, slots: [] };
        grouped[charId].slots.push({ slot: Number(match[2]), savedAt: data._savedAt, classes: data.classes });
      });
      return Object.keys(grouped).sort().map(function (id) { return grouped[id]; });
    }
    if (action === 'delete' && !slot) {
      var removed = [];
      for (var si = 1; si <= 3; si++) {
        var slotKey = 'char_' + id + '_slot' + si;
        if (localStorage.getItem(slotKey) !== null) {
          localStorage.removeItem(slotKey);
          removed.push(slotKey);
        }
      }
      if (!removed.length) throw new Error('角色不存在：' + id);
      return { deleted: true, keys: removed };
    }
    if (!key || !/^char_.+_slot[123]$/.test(key)) throw new Error('需要角色 ID 和 1–3 存档位');
    var raw = localStorage.getItem(key);
    if (action === 'get') {
      if (!raw) throw new Error('角色不存在：' + key);
      var result = JSON.parse(raw);
      if (value !== true && result.portrait) {
        var match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.*)$/.exec(result.portrait);
        if (match) {
          var encoded = match[2];
          var padding = encoded.slice(-2) === '==' ? 2 : encoded.slice(-1) === '=' ? 1 : 0;
          result.portraitInfo = { mime: match[1], bytes: Math.floor(encoded.length * 3 / 4) - padding };
        } else {
          result.portraitInfo = { kind: 'other' };
        }
        delete result.portrait;
      }
      return result;
    }
    if (action === 'delete') {
      if (!raw) throw new Error('角色不存在：' + key);
      localStorage.removeItem(key);
      return { deleted: true, key: key };
    }
    if (action === 'profile') {
      if (!raw) throw new Error('角色不存在：' + key);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('角色资料补丁必须是 JSON 对象');
      var allowed = ['gender', 'age', 'height', 'weight', 'eye', 'skin', 'hair', 'story', 'personality', 'traits', 'ideals', 'bonds', 'flaws'];
      var fields = Object.keys(value);
      if (!fields.length || fields.some(function (field) { return allowed.indexOf(field) < 0 || typeof value[field] !== 'string'; })) {
        throw new Error('角色资料仅支持性别、外貌与背景文字字段，值必须为字符串');
      }
      var profile = JSON.parse(raw);
      fields.forEach(function (field) {
        profile[field] = value[field];
        if (profile._creationSnapshot && typeof profile._creationSnapshot === 'object') profile._creationSnapshot[field] = value[field];
      });
      profile._savedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(profile));
      return { updated: true, key: key, id: id, slot: slot || 1, fields: fields };
    }
    if (action === 'portrait') {
      if (!raw) throw new Error('角色不存在：' + key);
      if (typeof value !== 'string' || !/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(value)) throw new Error('头像图片格式无效');
      var character = JSON.parse(raw);
      character.portrait = value;
      character._savedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(character));
      return { updated: true, key: key, id: id, slot: slot || 1 };
    }
    if (action === 'update') {
      if (!raw) throw new Error('角色不存在：' + key);
      var old = JSON.parse(raw);
      if ((old.xp || 0) > 0 || (old.classes || []).some(function (c) { return c.level > 1; })) throw new Error('只支持更新尚未升级的创建角色');
      var next = clone(value);
      next._charName = id;
      next._savedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(next));
      return { updated: true, key: key, character: next };
    }
    throw new Error('未知角色操作：' + action);
  }

  window.snowdChargenCli = {
    call: function (request) {
      var op = request.op;
      if (op === 'flow') return flow();
      if (op === 'catalog') return catalog(request.type, request.className);
      if (op === 'show') return show(request.type, request.name);
      if (op === 'rules') return rules(request.topic);
      if (op === 'options') return options(request.spec, request.step);
      if (op === 'preview') return preview(request.spec);
      if (op === 'save') return save(request.spec);
      if (op === 'characters') return characters(request.action, request.id, request.slot, request.value);
      throw new Error('未知操作：' + op);
    }
  };
})();
