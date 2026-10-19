/**
 * Core everyday vocabulary: the words a signer most needs for daily life — greetings,
 * people, food, home, health and emergencies, time, places, feelings, and the most common
 * verbs and descriptions. Used to MEASURE coverage (validateSeed.js / the vocabulary
 * report), not to create signs: a word here only gets a sign if a real source has one.
 * Words with no sign are fingerspelled or reported as unsigned, never given an invented sign.
 */
export const CORE_VOCABULARY = {
  social: ['hello', 'hi', 'bye', 'goodbye', 'please', 'thank you', 'thanks', 'sorry', 'excuse', 'welcome', 'yes', 'no',
    'ok', 'okay', 'fine', 'good', 'bad', 'nice', 'meet', 'name', 'friend', 'deaf', 'hearing', 'sign', 'understand',
    'again', 'slow', 'help', 'what', 'where', 'when', 'who', 'why', 'how', 'which'],
  people: ['i', 'me', 'my', 'you', 'your', 'he', 'she', 'we', 'they', 'mother', 'mom', 'father', 'dad', 'parents',
    'brother', 'sister', 'son', 'daughter', 'baby', 'child', 'children', 'family', 'husband', 'wife', 'grandmother',
    'grandfather', 'aunt', 'uncle', 'cousin', 'boy', 'girl', 'man', 'woman', 'people', 'person', 'boyfriend',
    'teacher', 'student', 'doctor', 'nurse', 'police', 'neighbor'],
  food: ['eat', 'drink', 'food', 'water', 'hungry', 'thirsty', 'breakfast', 'lunch', 'dinner', 'milk', 'coffee', 'tea',
    'juice', 'bread', 'egg', 'meat', 'chicken', 'fish', 'cheese', 'apple', 'banana', 'orange', 'fruit', 'vegetable',
    'soup', 'pizza', 'cake', 'cookie', 'candy', 'sugar', 'salt', 'restaurant', 'cook', 'kitchen', 'hamburger', 'beer',
    'wine', 'sandwich', 'potato', 'corn', 'ice cream'],
  home: ['home', 'house', 'room', 'bathroom', 'toilet', 'bed', 'sleep', 'table', 'chair', 'door', 'window', 'shower',
    'bath', 'clothes', 'shirt', 'pants', 'shoes', 'coat', 'phone', 'computer', 'tv', 'car', 'key', 'book', 'paper',
    'pen', 'bag', 'money', 'light', 'dog', 'cat', 'bird', 'clean', 'wash'],
  health: ['sick', 'hurt', 'pain', 'doctor', 'hospital', 'medicine', 'emergency', 'help', 'ambulance', 'fire', 'danger',
    'careful', 'stop', 'head', 'headache', 'stomach', 'heart', 'blood', 'cold', 'cough', 'pill', 'tired', 'rest',
    'body', 'health', 'better', 'worse', 'allergy', 'breathe'],
  feelings: ['happy', 'sad', 'angry', 'mad', 'scared', 'afraid', 'excited', 'bored', 'worried', 'worry', 'love', 'like',
    'hate', 'feel', 'surprised', 'confused', 'embarrassed', 'lonely', 'calm', 'proud', 'nervous', 'jealous', 'shy'],
  time: ['now', 'today', 'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'night', 'day', 'week', 'month',
    'year', 'time', 'hour', 'minute', 'later', 'before', 'after', 'always', 'sometimes', 'soon', 'early', 'late',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekend', 'birthday', 'holiday'],
  numbers: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'first', 'last',
    'number', 'many', 'few', 'more', 'all', 'half'],
  places: ['school', 'work', 'store', 'shop', 'church', 'library', 'bank', 'park', 'city', 'town', 'country', 'world',
    'office', 'class', 'college', 'university', 'hotel', 'airport', 'here', 'there', 'outside', 'inside'],
  travel: ['go', 'come', 'walk', 'drive', 'bus', 'train', 'airplane', 'bicycle', 'taxi', 'ticket', 'travel', 'left',
    'right', 'near', 'far', 'map', 'street'],
  verbs: ['want', 'need', 'have', 'know', 'think', 'see', 'look', 'watch', 'hear', 'listen', 'say', 'tell', 'talk', 'ask',
    'answer', 'read', 'write', 'learn', 'teach', 'study', 'play', 'work', 'live', 'give', 'take', 'buy', 'pay', 'sell',
    'make', 'use', 'open', 'close', 'start', 'finish', 'wait', 'try', 'remember', 'forget', 'find', 'lose', 'call',
    'visit', 'sit', 'stand', 'run', 'dance', 'swim', 'cry', 'laugh', 'smile', 'wake up', 'get up', 'bring', 'put',
    'change', 'move', 'send', 'show', 'come back', 'can', 'will', 'must', 'should', 'agree', 'believe', 'decide',
    'explain', 'practice', 'share', 'carry', 'follow', 'keep', 'meet', 'win', 'fix', 'break', 'cut', 'search'],
  describing: ['big', 'small', 'little', 'hot', 'cold', 'warm', 'new', 'old', 'young', 'same', 'different', 'easy',
    'hard', 'difficult', 'right', 'wrong', 'true', 'beautiful', 'pretty', 'ugly', 'fast', 'quick', 'slow', 'full',
    'empty', 'clean', 'dirty', 'expensive', 'cheap', 'important', 'ready', 'busy', 'free', 'open', 'closed', 'long',
    'short', 'tall', 'strong', 'weak', 'rich', 'poor', 'favorite', 'best', 'better', 'great', 'wonderful', 'terrible',
    'funny', 'interesting', 'dangerous', 'safe', 'quiet', 'loud'],
  colors: ['color', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'brown', 'gray'],
  weather: ['weather', 'rain', 'snow', 'sun', 'wind', 'cloud', 'hot', 'cold', 'summer', 'winter', 'spring', 'fall'],
};

export const CORE_WORDS = [...new Set(Object.values(CORE_VOCABULARY).flat())];
