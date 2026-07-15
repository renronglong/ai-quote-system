#!/usr/bin/env python3
"""
STEP 文件解析器 - 使用 cadquery/OCP 精确提取几何参数
支持单件模式和装配体自动拆分模式
输出 JSON 格式，供 Next.js API 调用
"""

import sys
import json
import os
import math

def analyze_single_shape(occ_shape, density=2.7):
    """分析单个 OCP shape，返回几何参数"""
    from OCP.GProp import GProp_GProps
    from OCP.BRepGProp import BRepGProp
    from OCP.TopAbs import TopAbs_FACE, TopAbs_EDGE
    from OCP.TopExp import TopExp_Explorer
    from OCP.Bnd import Bnd_Box
    from OCP.BRepBndLib import BRepBndLib
    
    # 包围盒
    bb = Bnd_Box()
    BRepBndLib.Add_s(occ_shape, bb)
    xmin, ymin, zmin, xmax, ymax, zmax = bb.Get()
    dim_x = round(xmax - xmin, 2)
    dim_y = round(ymax - ymin, 2)
    dim_z = round(zmax - zmin, 2)
    
    dims_sorted = sorted([dim_x, dim_y, dim_z])
    smallest = dims_sorted[0]
    middle = dims_sorted[1]
    largest = dims_sorted[2]
    
    # 表面积
    props = GProp_GProps()
    BRepGProp.SurfaceProperties_s(occ_shape, props)
    surface_area = round(props.Mass(), 2)
    
    # 体积
    props_vol = GProp_GProps()
    BRepGProp.VolumeProperties_s(occ_shape, props_vol)
    volume = round(props_vol.Mass(), 2)
    
    # 面/边数量
    face_count = 0
    edge_count = 0
    face_explorer = TopExp_Explorer(occ_shape, TopAbs_FACE)
    while face_explorer.More():
        face_count += 1
        face_explorer.Next()
    edge_explorer = TopExp_Explorer(occ_shape, TopAbs_EDGE)
    while edge_explorer.More():
        edge_count += 1
        edge_explorer.Next()
    
    # 重量
    weight_g = volume * density / 1000
    weight_kg = weight_g / 1000
    
    return {
        "boundingBox": {"x": dim_x, "y": dim_y, "z": dim_z},
        "dims_sorted": [smallest, middle, largest],
        "surfaceArea": surface_area,
        "volume": volume,
        "weight_g": weight_g,
        "weight_kg": weight_kg,
        "faceCount": face_count,
        "edgeCount": edge_count,
    }


def classify_extrusion(dims_sorted, volume):
    """
    改进的挤压件判断逻辑：
    1. 如果有两个维度接近（差<20%），第三个维度明显更大 → 挤压件
    2. 或者传统的长宽比>=2.5
    """
    smallest, middle, largest = dims_sorted
    
    is_extrusion = False
    
    # 方法1：两个小维度接近（差<20%），说明截面均匀
    if smallest > 0 and middle > 0:
        ratio_small_mid = smallest / middle  # 应该接近1
        ratio_large_mid = largest / middle if middle > 0 else 0
        
        # 两个截面维度差<20% 且 长度明显大于截面
        if ratio_small_mid >= 0.8 and ratio_large_mid >= 1.5:
            is_extrusion = True
        # 传统判断：长宽比>=2.5
        elif ratio_large_mid >= 2.5:
            is_extrusion = True
    
    # 计算截面面积和挤压参数
    cross_section_area = 0
    extrusion_length = largest
    cross_width = middle
    cross_height = smallest
    
    if is_extrusion and extrusion_length > 0:
        cross_section_area = round(volume / extrusion_length, 2)
    else:
        fill_factor = 0.7
        cross_section_area = round(cross_width * cross_height * fill_factor, 2)
    
    return {
        "isExtrusion": is_extrusion,
        "extrusion_length": extrusion_length,
        "cross_section_area": cross_section_area,
        "cross_width": cross_width,
        "cross_height": cross_height,
    }


def group_solids_by_bbox(solids_data, tolerance=0.5):
    """
    按包围盒尺寸对零件分组（容差tolerance mm）
    相同/相似的零件归为一组
    """
    groups = []
    
    for i, solid in enumerate(solids_data):
        dims = solid["dims_sorted"]  # [smallest, middle, largest]
        matched = False
        
        for group in groups:
            # 与组内第一个零件比较
            ref_dims = group["solids"][0]["dims_sorted"]
            
            # 每个维度差值都在容差内
            if (abs(dims[0] - ref_dims[0]) <= tolerance and
                abs(dims[1] - ref_dims[1]) <= tolerance and
                abs(dims[2] - ref_dims[2]) <= tolerance):
                group["solids"].append(solid)
                group["indices"].append(i)
                matched = True
                break
        
        if not matched:
            groups.append({
                "solids": [solid],
                "indices": [i],
            })
    
    return groups


def parse_step_file(file_path: str) -> dict:
    """
    解析 STEP 文件，提取几何参数
    自动检测是否为装配体（多个solid），并进行拆分分组
    """
    try:
        import cadquery as cq
        from OCP.TopExp import TopExp_Explorer
        from OCP.TopAbs import TopAbs_SOLID
    except ImportError as e:
        return {
            "success": False,
            "error": f"cadquery/OCP 未安装: {str(e)}",
        }

    if not os.path.exists(file_path):
        return {"success": False, "error": f"文件不存在: {file_path}"}

    try:
        # 读取 STEP 文件
        result = cq.importers.importStep(file_path)
        cq_shape = result.val() if hasattr(result, 'val') else result
        if hasattr(result, 'vals'):
            vals = result.vals()
            if vals:
                cq_shape = vals[0] if len(vals) == 1 else result
        
        occ_shape = cq_shape.wrapped if hasattr(cq_shape, 'wrapped') else cq_shape
        
        # ---- 检测所有 Solid ----
        solid_explorer = TopExp_Explorer(occ_shape, TopAbs_SOLID)
        solids = []
        while solid_explorer.More():
            solid_shape = solid_explorer.Current()
            solids.append(solid_shape)
            solid_explorer.Next()
        
        # 如果没有检测到子solid，用整个shape作为唯一solid
        if len(solids) == 0:
            solids = [occ_shape]
        
        density = 2.7  # 6063-T5 铝合金密度 g/cm³
        
        # ---- 分析每个 solid ----
        solids_data = []
        for solid in solids:
            data = analyze_single_shape(solid, density)
            extrusion_info = classify_extrusion(data["dims_sorted"], data["volume"])
            data["extrusion_info"] = extrusion_info
            solids_data.append(data)
        
        total_volume = round(sum(s["volume"] for s in solids_data), 2)
        total_weight_g = round(sum(s["weight_g"] for s in solids_data), 2)
        total_weight_kg = round(sum(s["weight_kg"] for s in solids_data), 4)
        
        # ---- 判断是否为装配体 ----
        is_assembly = len(solids_data) > 1
        
        if is_assembly:
            # 装配体模式：分组
            groups = group_solids_by_bbox(solids_data)
            
            unique_parts = []
            for idx, group in enumerate(groups):
                group_id = chr(ord('A') + idx)  # A, B, C, ...
                qty = len(group["solids"])
                ref = group["solids"][0]
                ext_info = ref["extrusion_info"]
                
                # 装配体中的零件默认都按挤压件处理
                # （因为装配体通常是挤压型材切割后焊接的）
                is_ext = ext_info["isExtrusion"]
                if not is_ext and len(solids_data) > 1:
                    is_ext = True
                    # 重新计算截面面积 = 体积 / 最大维度（长度）
                    largest_dim = ref["dims_sorted"][2]
                    if largest_dim > 0:
                        ext_info["cross_section_area"] = round(ref["volume"] / largest_dim, 2)
                        ext_info["extrusion_length"] = largest_dim
                        ext_info["cross_width"] = ref["dims_sorted"][1]
                        ext_info["cross_height"] = ref["dims_sorted"][0]
                
                part = {
                    "id": group_id,
                    "quantity": qty,
                    "dimensions": ref["dims_sorted"],  # [smallest, middle, largest]
                    "volume": ref["volume"],
                    "weight": round(ref["weight_g"], 2),
                    "weightKg": round(ref["weight_kg"], 4),
                    "isExtrusion": is_ext,
                    "crossSectionArea": ext_info["cross_section_area"],
                    "length": ext_info["extrusion_length"],
                    "crossWidth": ext_info["cross_width"],
                    "crossHeight": ext_info["cross_height"],
                    "surfaceArea": ref["surfaceArea"],
                    "faceCount": ref["faceCount"],
                }
                unique_parts.append(part)
            
            # 构建每个零件的pricingParams
            pricing_parts = []
            for part in unique_parts:
                if part["isExtrusion"]:
                    pricing_parts.append({
                        "partId": part["id"],
                        "productType": "extrusion",
                        "quantity": part["quantity"],
                        "outerWidth": round(part["crossWidth"], 2),
                        "outerHeight": round(part["crossHeight"], 2),
                        "length": round(part["length"], 2),
                        "isHollow": False,
                        "unitWeight": part["weightKg"],
                        "crossSectionArea": part["crossSectionArea"],
                        "surfaceTreatment": "氧化本色",
                        "sectionComplexity": "simple",
                    })
                else:
                    pricing_parts.append({
                        "partId": part["id"],
                        "productType": "plate",
                        "quantity": part["quantity"],
                        "width": round(part["crossWidth"], 2),
                        "height": round(part["crossHeight"], 2),
                        "thickness": round(part["dimensions"][0], 2),
                        "unitWeight": part["weightKg"],
                        "surfaceTreatment": "氧化本色",
                    })
            
            return {
                "success": True,
                "assembly": True,
                "partsCount": len(solids_data),
                "uniqueParts": unique_parts,
                "totalVolume": total_volume,
                "totalWeight": round(total_weight_g, 2),
                "totalWeightKg": total_weight_kg,
                "pricingParams": {
                    "productType": "assembly",
                    "assemblyType": "welded",
                    "parts": pricing_parts,
                },
            }
        else:
            # 单件模式
            data = solids_data[0]
            ext_info = data["extrusion_info"]
            smallest, middle, largest = data["dims_sorted"]
            
            # 重量
            weight_per_meter = round(ext_info["cross_section_area"] * density / 1000, 2)
            
            # 内腔判断
            bbox_section_area = ext_info["cross_width"] * ext_info["cross_height"]
            is_hollow = False
            if bbox_section_area > 0 and ext_info["cross_section_area"] / bbox_section_area < 0.7:
                is_hollow = True
            
            # 复杂度
            complexity = 'simple'
            if data["faceCount"] > 20:
                complexity = 'complex'
            elif data["faceCount"] > 12:
                complexity = 'medium'
            
            return {
                "success": True,
                "assembly": False,
                "partsCount": 1,
                "uniqueParts": [{
                    "id": "A",
                    "quantity": 1,
                    "dimensions": data["dims_sorted"],
                    "volume": data["volume"],
                    "weight": round(data["weight_g"], 2),
                    "weightKg": round(data["weight_kg"], 4),
                    "isExtrusion": ext_info["isExtrusion"],
                    "crossSectionArea": ext_info["cross_section_area"],
                    "length": ext_info["extrusion_length"],
                    "crossWidth": ext_info["cross_width"],
                    "crossHeight": ext_info["cross_height"],
                    "surfaceArea": data["surfaceArea"],
                    "faceCount": data["faceCount"],
                }],
                "totalVolume": total_volume,
                "totalWeight": round(total_weight_g, 2),
                "totalWeightKg": total_weight_kg,
                "boundingBox": data["boundingBox"],
                "dimensions": {
                    "smallest": smallest,
                    "middle": middle,
                    "largest": largest,
                },
                "volume": data["volume"],
                "surfaceArea": data["surfaceArea"],
                "weight": {
                    "grams": round(data["weight_g"], 2),
                    "kg": round(data["weight_kg"], 4),
                    "material": "6063-T5",
                    "density": density,
                },
                "topology": {
                    "faceCount": data["faceCount"],
                    "edgeCount": data["edgeCount"],
                },
                "extrusion": {
                    "isExtrusion": ext_info["isExtrusion"],
                    "length": ext_info["extrusion_length"],
                    "crossWidth": ext_info["cross_width"],
                    "crossHeight": ext_info["cross_height"],
                    "crossSectionArea": ext_info["cross_section_area"],
                    "weightPerMeter": weight_per_meter,
                    "isHollow": is_hollow,
                    "complexity": complexity,
                },
                "pricingParams": {
                    "productType": "extrusion" if ext_info["isExtrusion"] else "plate",
                    "outerWidth": round(ext_info["cross_width"], 2),
                    "outerHeight": round(ext_info["cross_height"], 2),
                    "length": round(ext_info["extrusion_length"], 2),
                    "isHollow": is_hollow,
                    "sectionComplexity": complexity if complexity != 'medium' else 'simple',
                    "unitWeight": round(data["weight_kg"], 4),
                    "crossSectionArea": ext_info["cross_section_area"],
                    "weightPerMeter": weight_per_meter,
                } if ext_info["isExtrusion"] else {
                    "productType": "plate",
                    "width": round(ext_info["cross_width"], 2),
                    "height": round(ext_info["cross_height"], 2),
                    "thickness": round(smallest, 2),
                    "unitWeight": round(data["weight_kg"], 4),
                },
            }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"解析失败: {str(e)}",
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "请提供 STEP 文件路径"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = parse_step_file(file_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
