// Lightweight i18n dictionary. Ukrainian is the default; English is the alternate.
// Flat dot-keys keep lookups simple. Interpolation uses {name} placeholders.

export type Lang = 'uk' | 'en';

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'uk', label: 'Українська', short: 'UA' },
  { code: 'en', label: 'English', short: 'EN' },
];

export const DEFAULT_LANG: Lang = 'uk';

type Dict = Record<string, string>;

const uk: Dict = {
  // nav
  'nav.about': 'Про дім',
  'nav.gallery': 'Галерея',
  'nav.amenities': 'Зручності',
  'nav.pricing': 'Ціни',
  'nav.location': 'Розташування',
  'nav.contact': 'Контакти',
  // cta / buttons
  'cta.checkAvailability': 'Перевірити дати',
  'cta.bookNow': 'Забронювати',
  'cta.viewHouse': 'Подивитися дім',
  'cta.seeDatesPrices': 'Дати та ціни',
  // hero
  'hero.headline': 'Ваш приватний прихисток на березі річки',
  'hero.subheadline':
    'Затишний дім 60 м² на тихій річці — риболовля, готування на вогні та гаряча купіль під відкритим небом.',
  // about
  'about.title': 'Дім біля води — лише для вас',
  'about.body':
    'Ізольований від урбанії, повна автономія на березі річки, це місце створене для того, щоб уповільнитися. Повна приватність, шум води і жодних думок, окрім відпочинку. Місце сили та єднання з природою.',
  // gallery
  'gallery.title': 'Наш прихисток',
  // amenities
  'amenities.title': 'Що робить його особливим',
  'amenity.fishing.title': 'Риболовля на річці',
  'amenity.fishing.body': 'Закидайте вудку за крок від дому на світанку.',
  'amenity.bbq.title': 'Барбекю на вогні',
  'amenity.bbq.body': 'Окрема зона з грилем для готування на живому вогні.',
  'amenity.tub.title': 'Гаряча купіль просто неба',
  'amenity.tub.body': 'Розслабтеся у теплій воді під зоряним небом.',
  'amenity.privacy.title': 'Повна приватність',
  'amenity.privacy.body': 'Відокремлений дім 60 м² — лише для вас.',
  'amenity.wildlife.title': 'Дика природа',
  'amenity.wildlife.body':
    'Зустрічайте та годуйте чарівних диких тварин — лебеді тут завжди.',
  // pricing
  'pricing.title': 'Прості та чесні ціни',
  'pricing.body':
    'Ціна за весь дім за ніч, з опціями для вихідних і сезону. Точні ціни та вільні дати — на сторінці бронювання.',
  // reviews
  'reviews.title': 'Історії гостей',
  // location
  'location.title': 'Як нас знайти',
  'location.fallback': 'Тихе, відлюдне місце з прямим виходом до річки.',
  'location.mapPlaceholder': 'Карту додасть власник у налаштуваннях.',
  // contact
  'contact.title': 'Зв’язатися з нами',
  'contact.note':
    'Бронювання підтверджуються особисто за телефоном. Пишіть будь-коли — будемо раді прийняти вас.',
  'contact.call': 'Зателефонувати',
  'contact.email': 'Пошта',
  'contact.find': 'Адреса',
  // footer
  'footer.tagline':
    'Приватний прихисток на березі річки. Бронювання підтверджуються особисто за телефоном.',
  'footer.follow': 'Слідкуйте за нами',
  'footer.rights': 'Усі права захищені.',
  'footer.producedBy': 'Створено',
  // booking
  'booking.title': 'Заявка на проживання',
  'booking.intro':
    'Оберіть дати та надішліть заявку. Ми підтверджуємо кожне бронювання особисто за телефоном — дати закріплюються лише після розмови.',
  'booking.legend.available': 'Вільно',
  'booking.legend.unavailable': 'Зайнято',
  'booking.selectCheckin': 'Оберіть дату заїзду',
  'booking.checkin': 'Заїзд',
  'booking.checkout': 'Виїзд',
  'booking.nowSelectCheckout': 'тепер оберіть дату виїзду',
  'booking.nights': 'ночей',
  'booking.minStay': 'Мінімальний термін для цих дат — {n} ночей.',
  'booking.form.name': 'Ваше ім’я',
  'booking.form.phone': 'Номер телефону',
  'booking.form.email': 'Email (необов’язково)',
  'booking.form.comments': 'Що нам варто знати? (необов’язково)',
  'booking.form.consent':
    'Я погоджуюсь, що зі мною зв’яжуться за телефоном для підтвердження заявки.',
  'booking.submit': 'Надіслати заявку',
  'booking.sending': 'Надсилання…',
  'booking.noPayment': 'Це лише заявка. Оплата зараз не стягується.',
  'booking.success.title': 'Заявку отримано',
  'booking.success.ref': 'Ваш номер заявки —',
  'booking.success.note':
    'Поки що нічого не заброньовано — власник зателефонує, щоб підтвердити ці дати.',
  'booking.error': 'Не вдалося надіслати. Спробуйте ще раз.',
};

const en: Dict = {
  'nav.about': 'About',
  'nav.gallery': 'Gallery',
  'nav.amenities': 'Amenities',
  'nav.pricing': 'Pricing',
  'nav.location': 'Location',
  'nav.contact': 'Contact',
  'cta.checkAvailability': 'Check availability',
  'cta.bookNow': 'Book now',
  'cta.viewHouse': 'View the house',
  'cta.seeDatesPrices': 'See dates & prices',
  'hero.headline': 'Your private riverside escape',
  'hero.subheadline':
    'A cozy 60 m² retreat on a quiet river — fishing, fire-cooking, and a heated tub under the open sky.',
  'about.title': 'A house by the water, all to yourself',
  'about.body':
    'Tucked away on an isolated stretch of riverbank, this 60 m² guest house is built for slowing down. Total privacy, the sound of the water, and nothing on the schedule but rest.',
  'gallery.title': 'The retreat',
  'amenities.title': 'What makes it special',
  'amenity.fishing.title': 'River fishing',
  'amenity.fishing.body': 'Cast a line steps from your door at first light.',
  'amenity.bbq.title': 'Open-fire BBQ',
  'amenity.bbq.body': 'A dedicated grill area for cooking over flame.',
  'amenity.tub.title': 'Heated outdoor tub',
  'amenity.tub.body': 'Soak under the open sky after sunset.',
  'amenity.privacy.title': 'Total privacy',
  'amenity.privacy.body': 'An isolated 60 m² house, all to yourself.',
  'amenity.wildlife.title': 'Wildlife',
  'amenity.wildlife.body':
    'Meet and feed the charming wild animals — the swans are always there.',
  'pricing.title': 'Simple, honest pricing',
  'pricing.body':
    'Whole-house nightly rate with weekend and seasonal options. See exact prices and available dates on the booking page.',
  'reviews.title': 'Guest stories',
  'location.title': 'Finding us',
  'location.fallback': 'A quiet, isolated spot with direct river access.',
  'location.mapPlaceholder': 'Map embed configured by the owner in settings.',
  'contact.title': 'Get in touch',
  'contact.note':
    'Bookings are confirmed personally by phone. Reach out any time — we’d love to host you.',
  'contact.call': 'Call us',
  'contact.email': 'Email',
  'contact.find': 'Find us',
  'footer.tagline':
    'A private riverside escape. Bookings confirmed personally by phone.',
  'footer.follow': 'Follow us',
  'footer.rights': 'All rights reserved.',
  'booking.title': 'Request your stay',
  'booking.intro':
    'Pick your dates, then send a request. We confirm every reservation personally by phone — your dates are only held once we’ve spoken.',
  'booking.legend.available': 'Available',
  'booking.legend.unavailable': 'Unavailable',
  'booking.selectCheckin': 'Select your check-in date',
  'booking.checkin': 'Check-in',
  'booking.checkout': 'Check-out',
  'booking.nowSelectCheckout': 'now select check-out',
  'booking.nights': 'nights',
  'booking.minStay': 'Minimum stay is {n} nights for these dates.',
  'booking.form.name': 'Your name',
  'booking.form.phone': 'Phone number',
  'booking.form.email': 'Email (optional)',
  'booking.form.comments': 'Anything we should know? (optional)',
  'booking.form.consent': 'I agree to be contacted by phone to confirm this request.',
  'booking.submit': 'Send booking request',
  'booking.sending': 'Sending…',
  'booking.noPayment': 'This sends a request only. No payment is taken now.',
  'booking.success.title': 'Request received',
  'booking.success.ref': 'Your reference is',
  'booking.success.note':
    'Nothing is booked yet — the owner will call you to confirm these dates.',
  'booking.error': 'Could not submit. Please try again.',
};

export const translations: Record<Lang, Dict> = { uk, en };
