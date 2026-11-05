// Icons for the "what's included" list. The DB stores only the key; admin picks from this set.
import type { ReactElement } from 'react';
import AcUnit from '@mui/icons-material/AcUnit';
import BedOutlined from '@mui/icons-material/BedOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import CleaningServices from '@mui/icons-material/CleaningServices';
import DirectionsWalk from '@mui/icons-material/DirectionsWalk';
import Dry from '@mui/icons-material/Dry';
import Fireplace from '@mui/icons-material/Fireplace';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import Kitchen from '@mui/icons-material/Kitchen';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import LocalParking from '@mui/icons-material/LocalParking';
import OutdoorGrill from '@mui/icons-material/OutdoorGrill';
import Phishing from '@mui/icons-material/Phishing';
import Shower from '@mui/icons-material/Shower';
import TvOutlined from '@mui/icons-material/TvOutlined';
import WaterDropOutlined from '@mui/icons-material/WaterDropOutlined';
import Wifi from '@mui/icons-material/Wifi';

export const INCLUDED_ICONS: { key: string; icon: ReactElement; uk: string; en: string }[] = [
  { key: 'check', icon: <CheckCircleOutline />, uk: 'Галочка', en: 'Check mark' },
  { key: 'home', icon: <HomeOutlined />, uk: 'Проживання', en: 'Stay' },
  { key: 'cleaning', icon: <CleaningServices />, uk: 'Прибирання', en: 'Cleaning' },
  { key: 'bed', icon: <BedOutlined />, uk: 'Постільна білизна', en: 'Bed linen' },
  { key: 'towel', icon: <Dry />, uk: 'Рушники', en: 'Towels' },
  { key: 'slippers', icon: <DirectionsWalk />, uk: 'Тапочки', en: 'Slippers' },
  { key: 'light', icon: <LightbulbOutlined />, uk: 'Світло', en: 'Electricity' },
  { key: 'water', icon: <WaterDropOutlined />, uk: 'Вода', en: 'Water' },
  { key: 'tv', icon: <TvOutlined />, uk: 'Телевізор', en: 'TV' },
  { key: 'fridge', icon: <Kitchen />, uk: 'Холодильник', en: 'Fridge' },
  { key: 'ac', icon: <AcUnit />, uk: 'Кондиціонер', en: 'Air conditioning' },
  { key: 'fireplace', icon: <Fireplace />, uk: 'Камін', en: 'Fireplace' },
  { key: 'shower', icon: <Shower />, uk: 'Душ', en: 'Shower' },
  { key: 'fishing', icon: <Phishing />, uk: 'Риболовля', en: 'Fishing' },
  { key: 'parking', icon: <LocalParking />, uk: 'Парковка', en: 'Parking' },
  { key: 'wifi', icon: <Wifi />, uk: 'Інтернет', en: 'Internet' },
  { key: 'grill', icon: <OutdoorGrill />, uk: 'Мангал', en: 'BBQ grill' },
];

const BY_KEY = new Map(INCLUDED_ICONS.map((i) => [i.key, i.icon]));
export const includedIcon = (key: string): ReactElement => BY_KEY.get(key) ?? BY_KEY.get('check')!;

// Name shown for the current site language, falling back to the other one if it is empty.
export const localizedName = (item: { name: string; nameEn?: string | null }, lang: 'uk' | 'en') =>
  (lang === 'en' ? item.nameEn || item.name : item.name || item.nameEn) ?? '';
