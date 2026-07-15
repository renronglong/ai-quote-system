#!/usr/bin/env python3
"""
STEP 文件解析 + 报价集成测试
使用 YL-876 测试文件验证完整流程
"""

import json
import sys
import os

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_step import parse_step_file

def test_parse_step():
    """测试 STEP 文件解析"""
    step_file = "/app/data/所有对话/主对话/用户上传/YL-876_100mm.step"
    
    if not os.path.exists(step_file):
        print(f"❌ 测试文件不存在: {step_file}")
        return False
    
    print("=" * 60)
    print("STEP 文件解析测试 - YL-876")
    print("=" * 60)
    
    result = parse_step_file(step_file)
    
    if not result["success"]:
        print(f"❌ 解析失败: {result['error']}")
        return False
    
    print("\n✅ 解析成功！\n")
    
    # 验证包围盒
    bb = result["boundingBox"]
    print(f"📏 包围盒: {bb['x']} × {bb['y']} × {bb['z']} mm")
    assert abs(bb['x'] - 38.7) < 0.1, f"X 维度异常: {bb['x']}"
    assert abs(bb['y'] - 21.7) < 0.1, f"Y 维度异常: {bb['y']}"
    assert abs(bb['z'] - 100.0) < 0.1, f"Z 维度异常: {bb['z']}"
    print("   ✅ 包围盒尺寸正确")
    
    # 验证体积
    vol = result["volume"]
    print(f"📦 体积: {vol} mm³")
    assert vol > 0, "体积应大于0"
    print("   ✅ 体积有效")
    
    # 验证重量
    weight = result["weight"]
    print(f"⚖️  重量: {weight['grams']} g ({weight['kg']} kg)")
    assert abs(weight['grams'] - 226.61) < 1, f"重量异常: {weight['grams']}"
    print("   ✅ 重量正确")
    
    # 验证拓扑
    topo = result["topology"]
    print(f"🔷 面数: {topo['faceCount']}, 边数: {topo['edgeCount']}")
    assert topo['faceCount'] == 10, f"面数量异常: {topo['faceCount']}"
    print("   ✅ 拓扑数据正确")
    
    # 验证挤压件判断
    ext = result["extrusion"]
    print(f"\n🔧 挤压件分析:")
    print(f"   是否挤压件: {ext['isExtrusion']}")
    print(f"   挤压方向: {ext['axis']}")
    print(f"   挤压长度: {ext['length']} mm")
    print(f"   截面尺寸: {ext['crossWidth']} × {ext['crossHeight']} mm")
    print(f"   截面面积: {ext['crossSectionArea']} mm²")
    print(f"   米重: {ext['weightPerMeter']} kg/m")
    print(f"   是否空心: {ext['isHollow']}")
    print(f"   复杂度: {ext['complexity']}")
    assert ext['isExtrusion'] == True, "应判定为挤压件"
    assert ext['isHollow'] == False, "应为实心"
    print("   ✅ 挤压件判断正确")
    
    # 验证报价参数
    pp = result["pricingParams"]
    print(f"\n💰 报价参数:")
    print(f"   产品类型: {pp['productType']}")
    print(f"   外宽: {pp['outerWidth']} mm")
    print(f"   外高: {pp['outerHeight']} mm")
    print(f"   长度: {pp['length']} mm")
    print(f"   截面积: {pp['crossSectionArea']} mm²")
    print(f"   单件重量: {pp['unitWeight']} kg")
    assert pp['productType'] == 'extrusion', "应为挤压件"
    print("   ✅ 报价参数正确")
    
    print("\n" + "=" * 60)
    print("✅ 所有测试通过！")
    print("=" * 60)
    
    # 输出完整结果供验证
    print("\n完整 JSON 输出:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    return True


if __name__ == "__main__":
    success = test_parse_step()
    sys.exit(0 if success else 1)
