// Terms & Conditions text (uk / en). Plain data so the page stays a dumb renderer.
// Facts (14:00/12:00, no prepayment, no deposit, 2 guests included, pets by arrangement,
// parties until 23:00) match the "Prices" section. Wording is a template: have the owner /
// a lawyer review it before relying on it.

export interface TermsSection {
  title: string;
  paragraphs: string[];
  /** Optional bullet list rendered after the paragraphs. */
  items?: string[];
}

export interface TermsDoc {
  title: string;
  updated: string;
  intro: string;
  sections: TermsSection[];
  contactTitle: string;
  contactBody: string;
  back: string;
  tocTitle: string;
  footerLink: string;
}

const uk: TermsDoc = {
  title: 'Правила та умови надання послуг',
  updated: 'Редакція від листопада 2026 р.',
  footerLink: 'Правила та умови',
  tocTitle: 'Зміст',
  back: 'На головну',
  intro:
    'Ці правила визначають порядок бронювання та проживання в LoveStory Riverside Retreat. Надсилаючи заявку на сайті або підтверджуючи бронювання телефоном, гість підтверджує, що ознайомився з цими правилами та погоджується з ними.',
  sections: [
    {
      title: 'Загальні положення',
      paragraphs: [
        '«Садиба» — LoveStory Riverside Retreat, об’єкт тимчасового проживання з прилеглою територією. «Гість» — особа, яка робить бронювання, та всі, хто проживає разом із нею. «Адміністрація» — власник або уповноважена ним особа.',
        'Послуги надаються на умовах цих правил, а також відповідно до чинного законодавства України, зокрема Цивільного кодексу України та Закону України «Про захист прав споживачів».',
        'Адміністрація може змінювати ці правила. Для вже підтвердженого бронювання діє редакція, яка була чинною на момент підтвердження.',
      ],
    },
    {
      title: 'Бронювання та підтвердження',
      paragraphs: [
        'Заявка на сайті не є підтвердженим бронюванням і сама по собі не блокує дати. Бронювання вважається підтвердженим після того, як адміністрація зателефонує гостю і домовиться про деталі.',
        'Дати блокуються для інших гостей лише після підтвердження. До цього часу на ті самі дати можуть надійти інші заявки; пріоритет має підтверджене бронювання.',
        'Гість зобов’язаний вказати правдиві контактні дані та точну кількість осіб, які проживатимуть, включно з дітьми.',
        'Адміністрація може відмовити у бронюванні, якщо дати вже зайняті або якщо умови заявки (кількість гостей, мета візиту) не відповідають правилам Садиби.',
      ],
    },
    {
      title: 'Вартість та оплата',
      paragraphs: [
        'Усі ціни вказані в гривнях (UAH). Актуальні тарифи, склад проживання та додаткові послуги наведені в розділі «Ціни» на головній сторінці. Орієнтовна вартість, розрахована на сайті, остаточно узгоджується під час телефонної розмови.',
        'Передоплата та застава не вимагаються. Розрахунок відбувається під час заселення, якщо інше не узгоджено з адміністрацією.',
        'У вартість включено проживання двох гостей. За кожного додаткового гостя встановлюється доплата, розмір якої уточнюється під час бронювання. Платні додаткові послуги (наприклад, чан) оплачуються окремо за тарифами розділу «Ціни».',
      ],
    },
    {
      title: 'Скасування та зміна бронювання',
      paragraphs: [
        'Оскільки передоплата не стягується, скасування бронювання безкоштовне. Просимо повідомити про зміну планів якомога раніше телефоном або електронною поштою, щоб дати можна було запропонувати іншим гостям.',
        'Зміна дат можлива за домовленістю з адміністрацією та залежить від наявності вільних дат.',
        'Якщо гість неодноразово не з’являється без попередження, адміністрація може відмовити йому в наступних бронюваннях.',
      ],
    },
    {
      title: 'Заїзд і виїзд',
      paragraphs: [
        'Заїзд — з 14:00, виїзд — до 12:00. Раніше заселення або пізніший виїзд можливі лише за попередньою домовленістю та за наявності такої можливості.',
        'Під час заселення адміністрація може попросити документ, що посвідчує особу, та ознайомити гостей із правилами безпеки на території.',
        'Прибуття після 22:00 потрібно узгодити заздалегідь.',
      ],
    },
    {
      title: 'Кількість гостей і відвідувачі',
      paragraphs: [
        'Кількість осіб, які проживають, не може перевищувати узгоджену під час бронювання. Максимальна місткість Садиби вказана на сайті.',
        'Сторонні відвідувачі допускаються лише за попередньою згодою адміністрації. Гість відповідає за поведінку всіх, кого запросив.',
      ],
    },
    {
      title: 'Правила проживання та поведінки',
      paragraphs: ['Щоб відпочинок був приємним для всіх, гості зобов’язуються дотримуватися таких правил:'],
      items: [
        'бережно ставитися до майна, будинку, меблів, обладнання та території;',
        'не курити в приміщеннях; для куріння використовувати відведені місця на вулиці;',
        'не залишати без нагляду відкритий вогонь, мангал, піч чи камін; користуватися ними лише за призначенням і гасити повністю;',
        'вечірки та гучні заходи дозволені до 23:00; з 23:00 до 08:00 діє режим тиші, поважайте спокій сусідів і тварин поблизу;',
        'домашні тварини допускаються лише за попередньою домовленістю; власник відповідає за їхню поведінку та чистоту;',
        'не використовувати піротехніку та інші вибухонебезпечні речовини;',
        'не залишати сміття на території, користуватися відведеними місцями для збору;',
        'не викидати в каналізацію сторонні предмети, не залишати відкритими воду та електроприлади без потреби;',
        'не вчиняти дій, що порушують чинне законодавство, громадський порядок або права інших осіб.',
      ],
    },
    {
      title: 'Вода, риболовля та безпека на території',
      paragraphs: [
        'Територія розташована поруч із водоймою. Купання, риболовля, катання на човні та інші активності на воді відбуваються на власний ризик гостей. Адміністрація не несе відповідальності за наслідки нехтування правилами безпеки.',
        'Діти повинні перебувати під постійним наглядом дорослих, особливо поблизу води, мангала, чана та відкритого вогню.',
        'Користування чаном та іншим обладнанням — відповідно до інструкцій адміністрації. Не рекомендується користуватися ним у стані алкогольного сп’яніння, а також за наявності медичних протипоказань.',
        'Риболовля здійснюється з дотриманням чинних правил рибальства; гості самостійно відповідають за дотримання вимог законодавства.',
      ],
    },
    {
      title: 'Пошкодження майна',
      paragraphs: [
        'Гість відповідає за збереження майна Садиби протягом усього часу проживання та відшкодовує шкоду, завдану ним, особами, які проживають разом із ним, його гостями та домашніми тваринами.',
        'Про будь-яке пошкодження або втрату майна гість зобов’язаний повідомити адміністрацію якнайшвидше.',
        'Розмір відшкодування визначається за фактичною вартістю ремонту або заміни пошкодженого майна на підставі підтверджувальних документів чи фотофіксації. Нормальний знос не вважається пошкодженням.',
        'Сильне забруднення приміщень або території, що потребує додаткового прибирання понад звичайне, може бути оплачене окремо за фактичними витратами.',
        'Перед виїздом адміністрація оглядає приміщення разом із гостем. Претензії, виявлені після виїзду, розглядаються за наявності підтверджень.',
      ],
    },
    {
      title: 'Відповідальність сторін',
      paragraphs: [
        'Адміністрація відповідає за надання проживання відповідно до опису на сайті та за безпечний стан об’єктів, якими користуються гості.',
        'Адміністрація не відповідає за збереження цінних речей, грошей, документів і техніки гостей, залишених без нагляду, а також за автомобілі та майно, залишені на території, за винятком випадків, передбачених законом.',
        'Адміністрація не відповідає за шкоду, завдану життю, здоров’ю чи майну гостей внаслідок порушення ними цих правил, правил безпеки або вимог законодавства.',
        'Гість несе відповідальність за порушення цих правил та чинного законодавства. У разі грубого або повторного порушення (зокрема, небезпечної поведінки, навмисного пошкодження майна, перевищення кількості гостей) адміністрація може припинити проживання без повернення вартості невикористаних днів.',
        'Сторони вирішують спірні питання шляхом переговорів. Закон не обмежує право споживача на захист своїх прав у встановленому порядку.',
      ],
    },
    {
      title: 'Форс-мажорні обставини',
      paragraphs: [
        'Сторони звільняються від відповідальності за повне або часткове невиконання зобов’язань, якщо воно спричинене обставинами непереборної сили, на які сторона не могла вплинути: воєнні дії та їх наслідки, обстріли, повітряні тривоги, що унеможливлюють проїзд чи перебування, введення комендантської години чи обмежень руху, стихійні лиха, пожежі, повені, аварії на мережах електро-, водопостачання, рішення органів державної влади.',
        'Сторона, на яку вплинули такі обставини, повинна якнайшвидше повідомити іншу сторону телефоном або електронною поштою.',
        'У разі форс-мажору бронювання за домовленістю переноситься на інші дати або скасовується без штрафних санкцій. Якщо було внесено будь-яку оплату, невикористана частина повертається або зараховується в рахунок майбутнього проживання.',
        'Короткочасні відключення електроенергії чи зв’язку, а також повітряні тривоги самі по собі не є підставою для повернення коштів за вже використане проживання. Під час тривоги гості мають діяти згідно з рекомендаціями органів влади та вказівками адміністрації.',
      ],
    },
    {
      title: 'Персональні дані',
      paragraphs: [
        'Для обробки заявки ми збираємо ім’я, номер телефону, електронну пошту (за бажанням) та відомості про бронювання. Дані використовуються виключно для зв’язку з гостем і виконання бронювання та не передаються третім особам, окрім випадків, передбачених законом.',
        'Подаючи заявку, гість дає згоду на обробку цих даних і на телефонний дзвінок для підтвердження. Гість може звернутися до адміністрації з проханням переглянути або видалити свої дані.',
      ],
    },
    {
      title: 'Прикінцеві положення',
      paragraphs: [
        'До відносин сторін застосовується законодавство України. Усі спори вирішуються шляхом переговорів, а в разі недосягнення згоди — у порядку, встановленому законодавством України.',
        'Якщо будь-яке положення цих правил буде визнано недійсним, решта положень зберігає чинність.',
      ],
    },
  ],
  contactTitle: 'Залишилися запитання?',
  contactBody: 'Зв’яжіться з нами — із задоволенням уточнимо будь-які умови до бронювання.',
};

const en: TermsDoc = {
  title: 'Terms & Conditions',
  updated: 'Version of November 2026',
  footerLink: 'Terms & Conditions',
  tocTitle: 'Contents',
  back: 'Back to home',
  intro:
    'These terms set out how booking and staying at LoveStory Riverside Retreat works. By sending a request on the website or confirming a booking by phone, the guest confirms that they have read and accept these terms.',
  sections: [
    {
      title: 'General',
      paragraphs: [
        '“The Retreat” means LoveStory Riverside Retreat, a short-stay accommodation with its grounds. “Guest” means the person making the booking and everyone staying with them. “Management” means the owner or a person authorised by the owner.',
        'Services are provided under these terms and in accordance with applicable Ukrainian law, including the Civil Code of Ukraine and the Law of Ukraine “On Consumer Rights Protection”.',
        'Management may update these terms. A confirmed booking is governed by the version in force when it was confirmed.',
      ],
    },
    {
      title: 'Booking and confirmation',
      paragraphs: [
        'A request on the website is not a confirmed booking and does not block the dates by itself. A booking is confirmed once Management has called the guest and agreed the details.',
        'Dates are blocked for other guests only after confirmation. Until then other requests may arrive for the same dates; a confirmed booking takes priority.',
        'The guest must provide truthful contact details and the exact number of people staying, including children.',
        'Management may decline a booking if the dates are already taken or if the request (number of guests, purpose of the visit) does not fit the Retreat’s rules.',
      ],
    },
    {
      title: 'Prices and payment',
      paragraphs: [
        'All prices are in Ukrainian hryvnia (UAH). Current rates, what is included and paid extras are listed in the “Prices” section of the home page. The estimate calculated on the website is finalised during the phone call.',
        'No prepayment or deposit is required. Payment is made on arrival unless otherwise agreed with Management.',
        'The price includes two guests. An extra charge applies for each additional guest; the amount is confirmed when booking. Paid extras (for example, the hot tub) are charged separately at the rates in the “Prices” section.',
      ],
    },
    {
      title: 'Cancellation and changes',
      paragraphs: [
        'Since no prepayment is taken, cancelling a booking is free. Please let us know as early as possible by phone or email so the dates can be offered to other guests.',
        'Changing dates is possible by arrangement with Management, subject to availability.',
        'If a guest repeatedly fails to show up without notice, Management may decline their future bookings.',
      ],
    },
    {
      title: 'Check-in and check-out',
      paragraphs: [
        'Check-in is from 14:00, check-out is by 12:00. Earlier check-in or later check-out is possible only by prior arrangement and subject to availability.',
        'On arrival Management may ask for an ID and brief guests on safety rules on the grounds.',
        'Arrival after 22:00 must be agreed in advance.',
      ],
    },
    {
      title: 'Number of guests and visitors',
      paragraphs: [
        'The number of people staying must not exceed the number agreed at booking. The Retreat’s maximum capacity is stated on the website.',
        'Outside visitors are allowed only with Management’s prior consent. The guest is responsible for the behaviour of everyone they invite.',
      ],
    },
    {
      title: 'House rules and conduct',
      paragraphs: ['To keep the stay pleasant for everyone, guests agree to:'],
      items: [
        'treat the property, house, furniture, equipment and grounds with care;',
        'not smoke indoors; use the designated outdoor areas for smoking;',
        'never leave open fire, the BBQ grill, stove or fireplace unattended; use them only as intended and extinguish them completely;',
        'parties and loud events are allowed until 23:00; quiet hours are 23:00–08:00 — please respect neighbours and nearby wildlife;',
        'bring pets only by prior arrangement; owners are responsible for their behaviour and cleanliness;',
        'not use fireworks or other explosive substances;',
        'not leave litter on the grounds and use the designated waste points;',
        'not flush foreign objects down the drains and not leave water or electrical appliances running needlessly;',
        'not act in breach of the law, public order or the rights of others.',
      ],
    },
    {
      title: 'Water, fishing and safety on the grounds',
      paragraphs: [
        'The grounds are next to a body of water. Swimming, fishing, boating and other water activities are at the guests’ own risk. Management is not liable for the consequences of ignoring safety rules.',
        'Children must be supervised by adults at all times, especially near water, the grill, the hot tub and open fire.',
        'The hot tub and other equipment must be used following Management’s instructions. Do not use it under the influence of alcohol or with medical contraindications.',
        'Fishing must comply with the applicable fishing regulations; guests are responsible for following the law.',
      ],
    },
    {
      title: 'Damage to property',
      paragraphs: [
        'The guest is responsible for the Retreat’s property throughout the stay and compensates damage caused by them, the people staying with them, their visitors and their pets.',
        'Any damage or loss must be reported to Management as soon as possible.',
        'Compensation is based on the actual cost of repairing or replacing the damaged item, supported by documents or photos. Normal wear and tear is not damage.',
        'Heavy soiling of the premises or grounds that requires cleaning beyond the usual may be charged separately at actual cost.',
        'Before departure Management inspects the premises together with the guest. Claims found after departure are considered if supported by evidence.',
      ],
    },
    {
      title: 'Liability',
      paragraphs: [
        'Management is responsible for providing accommodation as described on the website and for the safe condition of the facilities guests use.',
        'Management is not liable for valuables, money, documents or equipment left unattended, nor for vehicles and belongings left on the grounds, except where the law provides otherwise.',
        'Management is not liable for harm to the life, health or property of guests resulting from their breach of these terms, safety rules or the law.',
        'The guest is liable for breaching these terms and the law. In case of a serious or repeated breach (for example dangerous behaviour, deliberate damage, exceeding the number of guests) Management may end the stay without refunding unused days.',
        'The parties will try to resolve disputes through negotiation. Nothing here limits a consumer’s statutory right to protect their rights.',
      ],
    },
    {
      title: 'Force majeure',
      paragraphs: [
        'Neither party is liable for failing to perform, in whole or in part, if caused by circumstances beyond its control: hostilities and their consequences, shelling, air-raid alerts that prevent travel or stay, curfews or movement restrictions, natural disasters, fires, floods, utility outages, or decisions of public authorities.',
        'The affected party must notify the other as soon as possible by phone or email.',
        'In the event of force majeure the booking is, by agreement, moved to other dates or cancelled without penalty. Any payment made, for the unused part, is refunded or credited towards a future stay.',
        'Short power or connectivity outages and air-raid alerts alone are not grounds for a refund for accommodation already used. During an alert guests must follow the authorities’ guidance and Management’s instructions.',
      ],
    },
    {
      title: 'Personal data',
      paragraphs: [
        'To handle a request we collect your name, phone number, email (optional) and booking details. The data is used only to contact you and fulfil the booking and is not shared with third parties except where required by law.',
        'By submitting a request the guest consents to this processing and to a confirmation phone call. A guest may ask Management to review or delete their data.',
      ],
    },
    {
      title: 'Final provisions',
      paragraphs: [
        'Ukrainian law applies to the relationship between the parties. Disputes are resolved by negotiation and, failing agreement, as provided by Ukrainian law.',
        'If any provision of these terms is held invalid, the remaining provisions stay in force.',
      ],
    },
  ],
  contactTitle: 'Questions?',
  contactBody: 'Get in touch — we are happy to clarify any condition before you book.',
};

export const TERMS: Record<'uk' | 'en', TermsDoc> = { uk, en };

// ---- Editable text format (admin → Content → "terms.body") ----
// Intro paragraphs first, then "## Title" starts a section; a blank line separates paragraphs;
// lines starting with "- " are bullet points.
export const TERMS_KEY = 'terms.body';

export function serializeTerms(doc: TermsDoc): string {
  const blocks = [doc.intro];
  for (const s of doc.sections) {
    blocks.push(`## ${s.title}`, ...s.paragraphs);
    if (s.items) blocks.push(s.items.map((i) => `- ${i}`).join('\n'));
  }
  return blocks.join('\n\n');
}

export function parseTerms(text: string, base: TermsDoc): TermsDoc {
  const intro: string[] = [];
  const sections: TermsSection[] = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b) continue;
    if (b.startsWith('## ')) {
      // a heading may be followed by text on the next line without a blank line
      const [head = '', ...rest] = b.split('\n');
      sections.push({ title: head.slice(3).trim(), paragraphs: [] });
      if (rest.join('\n').trim()) pushBlock(sections, rest.join('\n').trim());
    } else if (sections.length === 0) {
      intro.push(b);
    } else {
      pushBlock(sections, b);
    }
  }
  return { ...base, intro: intro.join('\n\n'), sections };
}

function pushBlock(sections: TermsSection[], b: string) {
  const cur = sections[sections.length - 1];
  if (!cur) return;
  const lines = b.split('\n');
  if (lines.every((l) => l.trim().startsWith('- '))) {
    cur.items = [...(cur.items ?? []), ...lines.map((l) => l.trim().slice(2).trim())];
  } else {
    cur.paragraphs.push(lines.map((l) => l.trim()).join(' '));
  }
}
