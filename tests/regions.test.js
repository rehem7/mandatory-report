import test from 'node:test';
import assert from 'node:assert/strict';
import { regionData, resolveRegion, findRegionCodes } from '../public/regions.js';

test('地区上下级校验、旧草稿匹配和部分选择恢复', () => {
  const codes = { province: '430000', city: '430100', district: '430104' };
  assert.equal(regionData.length, 34);
  assert.equal(resolveRegion(codes).label, '湖南省 长沙市 岳麓区');
  assert.deepEqual(findRegionCodes('湖南省长沙市岳麓区'), codes);
  assert.equal(findRegionCodes('虚构旧地区'), null);
  assert.throws(() => resolveRegion({ ...codes, district: '440106' }), /匹配/);
  assert.throws(() => resolveRegion({ ...codes, city: '440100' }), /匹配/);
  assert.equal(resolveRegion({ province: '430000' }, true).complete, false);
  assert.throws(() => resolveRegion({ province: '430000' }), /匹配/);
  assert.equal(resolveRegion({ ...codes, district: 'unknown' }).label, '湖南省 长沙市（区县待核实）');
});
test('直辖市、不设区县城市、省直辖县及仅有省级数据的地区', () => {
  assert.equal(resolveRegion({ province: '110000', city: '110100', district: '110101' }).label, '北京市 东城区');
  assert.equal(resolveRegion({ province: '440000', city: '441900' }).label, '广东省 东莞市');
  assert.equal(resolveRegion({ province: '440000', city: '442000' }).complete, true);
  assert.equal(resolveRegion({ province: '500000', city: '500200', district: '500236' }).label, '重庆市 奉节县');
  assert.equal(resolveRegion({ province: '810000' }).label, '香港特别行政区');
  assert.equal(resolveRegion({ province: '710000' }).complete, true);
});
