import { regionData, resolveRegion, findRegionCodes, UNKNOWN_DISTRICT } from '/regions.js';

export function regionPicker(form) {
  const province = form.querySelector('#region-province'), city = form.querySelector('#region-city'), district = form.querySelector('#region-district');
  const hidden = form.elements.region, hint = form.querySelector('#region-hint'), legacy = form.querySelector('#region-legacy');
  let legacyText = '';
  const options = (select, items, placeholder, selected = '') => {
    select.replaceChildren(new Option(placeholder, ''), ...items.map(item => new Option(item.name, item.code)));
    select.value = selected;
  };
  const current = () => ({ province: province.value, city: city.value, district: district.value });
  function refresh(value = {}) {
    const parent = regionData.find(p => p.code === province.value), cities = parent?.children || [];
    options(city, cities.map(c => ({ ...c, name: c.name === '县' ? '直辖县' : c.name })), cities.length ? '请选择市 / 地区' : parent ? '请在详细地址补充市县' : '请先选择省份', value.city);
    city.disabled = !cities.length; city.required = !!cities.length;
    const child = cities.find(c => c.code === city.value), districts = child?.children || [];
    options(district, districts.length ? [...districts, { name: '暂不确定区县', code: UNKNOWN_DISTRICT }] : [], districts.length ? '请选择区 / 县' : child ? '该市不设区县' : '请先选择城市', value.district);
    district.disabled = !districts.length; district.required = !!districts.length;
    hint.textContent = parent && !cities.length ? '该地区暂未收录下级区划，请在详细地址中补充。' : child && !districts.length ? '该市不设区县，请在详细地址中填写街道、学校等具体地点。' : '省市区县联动选择；暂不确定区县时，可先选择上级地区并补充详细地址。';
    update();
  }
  function update() {
    const result = resolveRegion(current(), true);
    hidden.value = result.complete ? result.label : '';
    if (result.complete) legacyText = '';
    legacy.hidden = !legacyText;
    legacy.textContent = legacyText ? `原草稿地区：${legacyText}。请在下拉列表中确认地区。` : '';
  }
  options(province, regionData, '请选择省 / 自治区 / 直辖市');
  refresh();
  province.addEventListener('change', () => refresh());
  city.addEventListener('change', () => refresh({ city: city.value }));
  district.addEventListener('change', update);
  return {
    get codes() { return current(); },
    get legacyText() { return legacyText; },
    restore(fields) {
      legacyText = fields.regionLegacy || fields.region || '';
      let value = fields.regionCodes || findRegionCodes(fields.region) || {};
      try { resolveRegion(value, true); } catch { value = {}; }
      province.value = value.province || ''; refresh(value);
    },
    reset() { legacyText = ''; province.value = ''; refresh(); }
  };
}
