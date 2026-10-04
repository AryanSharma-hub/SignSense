/**
 * Curated word lists for the bulk-generated draft vocabulary (~700 gestures), grouped
 * by category with a rough part-of-speech per group. Each is a genuinely common,
 * everyday word or phrase — not padding. generate.js turns these into full gesture
 * entries (parameters are assigned deterministically, not linguistically — see there).
 *
 * A few words that real-world tests rely on staying unmatched ("sandwich", "where",
 * "bathroom") are deliberately left out — see EXCLUDE_GLOSSES in generate.js.
 */
export const CATEGORIES = [
  ['numbers', 'adj', [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
    'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
    'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  ]],
  ['pronouns', 'pronoun', [
    'we', 'they', 'he', 'she', 'everyone', 'someone', 'nobody', 'everybody', 'somebody', 'anybody',
    'nothing', 'everything', 'something', 'anything', 'who', 'whoever', 'himself', 'herself', 'ourselves', 'themselves',
  ]],
  ['family', 'noun', [
    'sister', 'brother', 'grandmother', 'grandfather', 'grandparents', 'aunt', 'uncle', 'cousin', 'son', 'daughter',
    'wife', 'husband', 'baby', 'child', 'children', 'family', 'parent', 'parents', 'niece', 'nephew',
    'friend', 'neighbor', 'relative', 'twins',
  ]],
  ['food', 'noun', [
    'bread', 'rice', 'meat', 'chicken', 'fish', 'egg', 'eggs', 'milk', 'coffee', 'tea', 'juice', 'fruit',
    'apple', 'banana', 'orange', 'grape', 'watermelon', 'vegetable', 'carrot', 'potato', 'tomato', 'onion', 'garlic',
    'cheese', 'butter', 'sugar', 'salt', 'pepper', 'soup', 'pizza', 'cake', 'cookie', 'candy', 'chocolate',
    'hamburger', 'noodles', 'pasta', 'salad', 'honey', 'jam', 'yogurt', 'cereal', 'popcorn', 'corn', 'bean', 'beans',
    'soda', 'beer', 'wine', 'restaurant', 'kitchen', 'cook', 'recipe', 'menu', 'waiter',
  ]],
  ['emotions', 'adj', [
    'happy', 'sad', 'angry', 'scared', 'afraid', 'excited', 'tired', 'bored', 'surprised', 'nervous',
    'worried', 'confused', 'proud', 'embarrassed', 'jealous', 'lonely', 'calm', 'confident', 'frustrated',
    'disappointed', 'anxious', 'relieved', 'curious', 'hopeful', 'guilty', 'ashamed', 'brave', 'shy',
  ]],
  ['question-words', 'pronoun', ['what', 'when', 'why', 'which', 'whose', 'how']],
  ['verbs', 'verb', [
    'go', 'come', 'see', 'look', 'hear', 'listen', 'speak', 'talk', 'read', 'write', 'work', 'play',
    'sleep', 'wake', 'walk', 'run', 'sit', 'stand', 'stop', 'start', 'finish', 'open', 'close', 'give', 'take',
    'buy', 'sell', 'pay', 'learn', 'teach', 'understand', 'remember', 'forget', 'think', 'know', 'believe',
    'feel', 'live', 'die', 'born', 'marry', 'divorce', 'visit', 'meet', 'wait', 'hurry', 'try', 'win', 'lose',
    'share', 'like', 'hate', 'enjoy', 'hope', 'dream', 'plan', 'decide', 'choose', 'change', 'continue',
  ]],
  ['nouns', 'noun', [
    'house', 'home', 'room', 'door', 'window', 'table', 'chair', 'bed', 'book', 'pen', 'paper', 'phone',
    'computer', 'car', 'bus', 'train', 'airplane', 'bicycle', 'money', 'key', 'bag', 'clothes', 'shirt', 'shoes',
    'hat', 'glasses', 'watch', 'clock', 'television', 'music', 'movie', 'picture', 'letter', 'name', 'job',
    'school', 'teacher', 'student', 'doctor', 'nurse', 'police', 'fire', 'hospital',
  ]],
  ['places', 'noun', [
    'store', 'market', 'bank', 'park', 'beach', 'mountain', 'city', 'town', 'country', 'world', 'church',
    'library', 'airport', 'station',
  ]],
  ['colors', 'adj', ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'black', 'white', 'brown', 'gray', 'gold', 'silver']],
  ['time', 'noun', [
    'today', 'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'night', 'week', 'month', 'year',
    'hour', 'minute', 'soon', 'later', 'now', 'always', 'never', 'sometimes', 'often', 'early', 'late',
  ]],
  ['weather', 'noun', ['weather', 'sun', 'rain', 'snow', 'wind', 'cloud', 'storm', 'hot', 'cold', 'warm', 'cool', 'ice', 'fog', 'thunder', 'lightning']],
  ['school-work', 'noun', [
    'class', 'homework', 'test', 'exam', 'grade', 'pencil', 'office', 'meeting', 'boss', 'coworker',
    'project', 'deadline', 'break', 'vacation', 'holiday',
  ]],
  ['travel', 'noun', ['map', 'ticket', 'passport', 'luggage', 'hotel', 'trip']],
  ['body', 'noun', ['head', 'face', 'eye', 'ear', 'nose', 'mouth', 'hand', 'arm', 'leg', 'foot', 'finger', 'hair', 'back', 'stomach', 'heart']],
  ['adjectives', 'adj', [
    'big', 'small', 'tall', 'short', 'long', 'wide', 'heavy', 'light', 'fast', 'slow', 'strong', 'weak',
    'old', 'young', 'new', 'clean', 'dirty', 'full', 'empty', 'closed', 'easy', 'hard', 'difficult',
    'important', 'dangerous', 'safe', 'expensive', 'cheap', 'beautiful', 'ugly', 'quiet', 'loud', 'soft',
  ]],
  ['calendar', 'noun', [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  ]],
  ['social', 'interj', ['goodbye', 'bye', 'welcome', 'sorry', 'congratulations']],
  ['clothing', 'noun', ['pants', 'dress', 'skirt', 'jacket', 'coat', 'sweater', 'socks', 'boots', 'gloves', 'scarf', 'belt', 'tie']],
  ['kitchen', 'noun', [
    'spoon', 'fork', 'knife', 'plate', 'cup', 'bowl', 'pot', 'pan', 'refrigerator', 'stove', 'oven', 'sink',
    'towel', 'blanket', 'pillow', 'sofa', 'lamp', 'mirror', 'closet', 'shelf', 'broom', 'trash',
  ]],
  ['sports', 'noun', [
    'soccer', 'football', 'basketball', 'baseball', 'tennis', 'swimming', 'running', 'golf', 'volleyball',
    'hockey', 'boxing', 'wrestling', 'skiing', 'skating', 'yoga', 'gym', 'exercise', 'team', 'game', 'score', 'ball', 'coach',
  ]],
  ['technology', 'noun', [
    'internet', 'email', 'website', 'password', 'app', 'camera', 'video', 'photo', 'message', 'text',
    'wifi', 'battery', 'charger', 'screen', 'keyboard', 'mouse', 'printer', 'download', 'upload',
  ]],
  ['academic', 'noun', [
    'math', 'science', 'history', 'geography', 'art', 'biology', 'chemistry', 'physics', 'literature',
    'language', 'economics', 'psychology', 'philosophy',
  ]],
  ['transport', 'noun', ['boat', 'ship', 'taxi', 'subway', 'motorcycle', 'truck', 'ambulance']],
  ['nature', 'noun', [
    'tree', 'flower', 'grass', 'river', 'lake', 'ocean', 'sea', 'forest', 'desert', 'island', 'sky',
    'star', 'moon', 'rock', 'stone', 'sand',
  ]],
  ['health', 'noun', [
    'sick', 'healthy', 'pain', 'hurt', 'medicine', 'pill', 'surgery', 'injection', 'fever', 'headache',
    'flu', 'allergy', 'wheelchair', 'bandage',
  ]],
  ['money', 'noun', ['price', 'discount', 'sale', 'cash', 'bill', 'coin', 'wallet', 'shopping', 'receipt']],
  ['relationships', 'noun', ['marriage', 'wedding', 'boyfriend', 'girlfriend', 'fiance', 'single', 'married', 'dating', 'partner']],
  ['countries', 'noun', [
    'usa', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'peru', 'colombia', 'cuba', 'jamaica',
    'england', 'scotland', 'wales', 'ireland', 'france', 'germany', 'spain', 'portugal', 'italy', 'greece',
    'netherlands', 'belgium', 'switzerland', 'austria', 'poland', 'russia', 'ukraine', 'sweden', 'norway',
    'denmark', 'finland', 'iceland', 'turkey', 'egypt', 'morocco', 'nigeria', 'kenya', 'ethiopia',
    'south africa', 'ghana', 'china', 'japan', 'korea', 'india', 'pakistan', 'bangladesh', 'vietnam',
    'thailand', 'philippines', 'indonesia', 'malaysia', 'singapore', 'australia', 'new zealand', 'israel',
    'iran', 'iraq', 'syria', 'lebanon', 'jordan', 'saudi arabia',
  ]],
  ['languages', 'noun', ['english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'chinese', 'japanese', 'korean', 'arabic', 'russian', 'hindi']],
  ['animals', 'noun', [
    'dog', 'cat', 'bird', 'horse', 'cow', 'pig', 'sheep', 'goat', 'monkey', 'gorilla', 'lion', 'tiger', 'bear',
    'elephant', 'rabbit', 'mouse', 'snake', 'wolf', 'fox', 'deer', 'squirrel', 'frog', 'duck', 'shrimp',
    'jellyfish', 'whale', 'dolphin', 'shark', 'turtle', 'spider', 'bee', 'butterfly', 'ant', 'owl', 'eagle',
  ]],
  ['furniture-extra', 'noun', ['dresser', 'bathtub', 'dishwasher', 'cabinet', 'freezer', 'couch', 'drawer', 'rug', 'curtain', 'fence', 'ladder', 'bench']],
  // Sourced from a public 1000-most-common-English-words frequency list (gist.github.com/
  // deekayen/4148741), filtered down to concrete, unambiguous content words not already
  // covered — pure function/grammar words are excluded centrally in generate.js
  // (GRAMMAR_WORDS), and anything colliding with an existing gloss or keyword is dropped
  // automatically by the same dedup that runs over every category.
  ['common-extra', 'noun', [
    'word', 'other', 'use', 'time', 'write', 'long', 'make', 'thing', 'number', 'sound', 'people', 'call', 'down',
    'find', 'work', 'get', 'place', 'after', 'back', 'little', 'man', 'woman', 'show', 'give', 'form', 'line',
    'turn', 'cause', 'move', 'boy', 'set', 'air', 'play', 'small', 'put', 'read', 'hand', 'large', 'add', 'land',
    'high', 'follow', 'act', 'ask', 'men', 'change', 'light', 'need', 'house', 'try', 'point', 'build', 'page',
    'answer', 'grow', 'study', 'learn', 'plant', 'cover', 'sun', 'state', 'keep', 'eye', 'last', 'thought',
    'cross', 'farm', 'hard', 'saw', 'draw', 'late', 'run', 'press', 'real', 'life', 'north', 'seem', 'together',
    'next', 'mark', 'letter', 'mile', 'river', 'feet', 'care', 'book', 'carry', 'took', 'science', 'began',
    'base', 'hear', 'cut', 'sure', 'watch', 'main', 'plain', 'usual', 'ready', 'list', 'feel', 'soon', 'body',
    'direct', 'leave', 'song', 'measure', 'product', 'black', 'numeral', 'order', 'piece', 'pass', 'whole',
    'king', 'heard', 'best', 'true', 'during', 'remember', 'step', 'hold', 'ground', 'interest', 'reach', 'verb',
    'travel', 'less', 'simple', 'several', 'pattern', 'serve', 'appear', 'road', 'rule', 'govern', 'pull',
    'notice', 'voice', 'unit', 'power', 'certain', 'fly', 'lead', 'cry', 'machine', 'note', 'wait', 'figure',
    'box', 'rest', 'correct', 'able', 'pound', 'done', 'beauty', 'drive', 'contain', 'front', 'teach', 'final',
    'develop', 'mind', 'behind', 'clear', 'produce', 'fact', 'course', 'stay', 'force', 'object', 'decide',
    'surface', 'deep', 'system', 'busy', 'record', 'possible', 'wonder', 'laugh', 'check', 'shape', 'miss',
    'brought', 'tire', 'bring', 'distant', 'fill', 'paint', 'language', 'grand', 'wave', 'drop', 'present',
    'heavy', 'dance', 'position', 'wide', 'sail', 'material', 'vary', 'settle', 'speak', 'weight', 'general',
    'matter', 'pair', 'include', 'divide', 'felt', 'pick', 'sudden', 'count', 'square', 'reason', 'length',
    'represent', 'subject', 'region', 'energy', 'hunt', 'bed', 'ride', 'believe', 'race', 'catch', 'mount',
    'wish', 'board', 'written', 'kept', 'edge', 'sign', 'visit', 'soft', 'fun', 'gas', 'finish', 'strange',
    'gone', 'jump', 'raise', 'solve', 'push', 'describe', 'result', 'hill', 'safe', 'consider', 'bit', 'copy',
    'phrase', 'tall', 'soil', 'roll', 'temperature', 'finger', 'industry', 'value', 'fight', 'lie', 'view',
    'sense', 'broke', 'case', 'kill', 'moment', 'scale', 'observe', 'straight', 'speed', 'method', 'organ',
    'pay', 'section', 'surprise', 'design', 'experiment', 'iron', 'stick', 'trade', 'trip', 'receive', 'row',
    'exact', 'trouble', 'shout', 'join', 'suggest', 'lady', 'rise', 'mix', 'lost', 'equal', 'practice',
    'protect', 'locate', 'character', 'period', 'history', 'expect', 'modern', 'hit', 'corner', 'supply',
    'provide', 'agree', 'process', 'guess', 'sharp', 'create', 'compare', 'string', 'depend', 'rub', 'famous',
    'stream', 'sight', 'hurry', 'chief', 'major', 'search', 'allow', 'print', 'spot', 'success', 'swim', 'term',
    'deal', 'arrange', 'camp', 'invent', 'determine', 'level', 'stretch', 'property', 'select', 'wrong',
    'require', 'broad', 'prepare', 'claim', 'solution', 'discuss', 'forward', 'similar', 'guide', 'experience',
    'score', 'led', 'mass', 'total', 'master', 'track', 'connect', 'spend', 'original', 'charge', 'proper',
    'instant', 'degree', 'support', 'nature', 'motion',
  ]],
];
