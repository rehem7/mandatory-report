import { regionData } from './region-data.js';
export { regionData };
export const UNKNOWN_DISTRICT = 'unknown';
const fail = () => { throw Object.assign(Error('请选择匹配的省、市和区县'), { status: 400 }); };
const joinNames = (province, city, district) => [province?.name, city?.name === '县' || /直辖县级/.test(city?.name || '') ? '' : city?.name, district?.name].filter((name, i, names) => name && name !== names[i - 1]).join(' ');
export function resolveRegion(value, partial = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const codes = Object.fromEntries(['province', 'city', 'district'].map(key => [key, typeof value[key] === 'string' ? value[key] : '']));
  if (!codes.province && partial && !codes.city && !codes.district) return { codes, label: '', complete: false };
  const province = regionData.find(p => p.code === codes.province); if (!province) fail();
  const cities = province.children || [];
  if (!cities.length) { if (codes.city || codes.district) fail(); return { codes, label: province.name, complete: true }; }
  if (!codes.city && partial && !codes.district) return { codes, label: province.name, complete: false };
  const city = cities.find(c => c.code === codes.city); if (!city) fail();
  const districts = city.children || [];
  if (!districts.length) { if (codes.district) fail(); return { codes, label: joinNames(province, city), complete: true }; }
  if (codes.district === UNKNOWN_DISTRICT) return { codes, label: joinNames(province, city) + '（区县待核实）', complete: true };
  if (!codes.district && partial) return { codes, label: joinNames(province, city), complete: false };
  const district = districts.find(d => d.code === codes.district); if (!district) fail();
  return { codes, label: joinNames(province, city, district), complete: true };
}
export function findRegionCodes(text) {
  const value = String(text || '').replace(/\s+/g, '');
  if (!value) return null;
  const matches = [];
  for (const province of regionData) {
    if (!province.children?.length && value === province.name) return { province: province.code, city: '', district: '' };
    for (const city of province.children || []) {
      if (!city.children?.length && value === joinNames(province, city).replace(/\s+/g, '')) return { province: province.code, city: city.code, district: '' };
      for (const district of city.children || []) if (value.includes(district.name) && (value.includes(city.name) || value.includes(province.name))) matches.push({ province: province.code, city: city.code, district: district.code });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}
