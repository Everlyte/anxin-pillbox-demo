import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLocal,transition,validItems} from './logic.mjs';
test('不会从每日两次推断具体时间',()=>{assert.deepEqual(extractLocal('示例药品 A，每日两次，每次 1 片'),[{name:'示例药品 A',dose:'1 片',time:''}]);});
test('开盒不能自动成为已服用，重复开盒保留确认或不确定状态',()=>{assert.equal(transition('pending','open'),'opened');assert.equal(transition('opened','open'),'opened');assert.equal(transition('confirmed','open'),'confirmed');assert.equal(transition('uncertain','open'),'uncertain');});
test('不确定状态只有用户核实确认后才能完成',()=>{assert.equal(transition('opened','uncertain'),'uncertain');assert.equal(transition('uncertain','confirm'),'confirmed');});
test('时间和剂量缺失不能生成有效计划',()=>{assert.equal(validItems([{name:'A',dose:'1 片',time:'',slot:1}]),false);assert.equal(validItems([{name:'A',dose:'',time:'08:00',slot:1}]),false);assert.equal(validItems([{name:'A',dose:'1 片',time:'08:00',slot:1}]),true);});
test('完整示例支持中文逗号分隔，保留明确时间和用量',()=>{assert.deepEqual(extractLocal('示例药品 A，08:00，每次 1 片'),[{name:'示例药品 A',dose:'1 片',time:'08:00'}]);});
