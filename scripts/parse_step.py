#!/usr/bin/env python3
"""
STEP 文件解析器 - 使用 cadquery/OCP 精确提取几何参数
输出 JSON 格式，供 Next.js API 调用
"""

import sys
import json
import os
import math

def parse_step_file(file_path: str) -> dict:
    """
    解析 STEP 文件，提取几何参数
    """
    try:
        import cadquery as cq
        from OCP.GProp import GProp_GProps
        from OCP.BRepGProp import BRepGProp
        from OCP.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCP.TopExp import TopExp_Explorer
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
        
        # 获取 cadquery 形状对象
        cq_shape = result.val() if hasattr(result, 'val') else result
        if hasattr(result, 'vals'):
            vals = result.vals()
            if vals:
                cq_shape = vals[0] if len(vals) == 1 else result
        
        # 获取底层 OCP TopoDS_Shape
        occ_shape = cq_shape.wrapped if hasattr(cq_shape, 'wrapped') else cq_shape
        
        # ---- 包围盒（使用 cadquery API）----
        bb = cq_shape.BoundingBox()
        dim_x = round(bb.xmax - bb.xmin, 2)
        dim_y = round(bb.ymax - bb.ymin, 2)
        dim_z = round(bb.zmax - bb.zmin, 2)
        
        # 排序维度（从小到大）
        dims_sorted = sorted([dim_x, dim_y, dim_z])
        smallest = dims_sorted[0]
        middle = dims_sorted[1]
        largest = dims_sorted[2]
        
        # ---- 体积和表面积（使用 OCP GProp_GProps）----
        props = GProp_GProps()
        BRepGProp.SurfaceProperties_s(occ_shape, props)
        surface_area = round(props.Mass(), 2)  # 表面积 mm²
        
        props_vol = GProp_GProps()
        BRepGProp.VolumeProperties_s(occ_shape, props_vol)
        volume = round(props_vol.Mass(), 2)  # 体积 mm³
        
        # ---- 面数量和边数量 ----
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
        
        # ---- 重量计算（默认 6063-T5 铝合金，密度 2.7 g/cm³）----
        density = 2.7  # g/cm³
        weight_g = volume * density / 1000  # mm³ -> cm³ -> g
        weight_kg = weight_g / 1000
        
        # ---- 挤压件判断 ----
        # 如果一个维度远大于其他两个（比例 > 3:1），则判定为挤压件
        is_extrusion = False
        extrusion_axis = None
        cross_width = middle
        cross_height = smallest
        extrusion_length = largest
        
        if largest > 0 and middle > 0:
            ratio_1 = largest / middle if middle > 0 else 0
            ratio_2 = largest / smallest if smallest > 0 else 0
            
            # 最长维度 / 中间维度 > 2.5 且 截面相对均匀
            if ratio_1 >= 2.5:
                is_extrusion = True
                # 确定挤压方向
                if dim_x == largest:
                    extrusion_axis = 'x'
                    cross_width = dim_y
                    cross_height = dim_z
                    extrusion_length = dim_x
                elif dim_y == largest:
                    extrusion_axis = 'y'
                    cross_width = dim_x
                    cross_height = dim_z
                    extrusion_length = dim_y
                else:
                    extrusion_axis = 'z'
                    cross_width = dim_x
                    cross_height = dim_y
                    extrusion_length = dim_z
        
        # ---- 截面面积估算 ----
        # 用体积 / 长度得到精确截面面积
        if extrusion_length > 0 and is_extrusion:
            cross_section_area = round(volume / extrusion_length, 2)
        else:
            # 非挤压件，用包围盒截面面积 * 填充系数
            fill_factor = 0.7 if face_count <= 12 else 0.5
            cross_section_area = round(cross_width * cross_height * fill_factor, 2)
        
        # 米重
        weight_per_meter = round(cross_section_area * density / 1000, 2)  # kg/m
        
        # ---- 判断是否有内腔 ----
        # 简化判断：如果截面面积 < 包围盒截面积的 70%，可能有内腔
        bbox_section_area = cross_width * cross_height
        is_hollow = False
        if bbox_section_area > 0 and cross_section_area / bbox_section_area < 0.7:
            is_hollow = True
        
        # ---- 复杂度判断 ----
        # 面数量越多越复杂
        complexity = 'simple'
        if face_count > 20:
            complexity = 'complex'
        elif face_count > 12:
            complexity = 'medium'
        
        return {
            "success": True,
            "boundingBox": {
                "x": dim_x,
                "y": dim_y,
                "z": dim_z,
            },
            "dimensions": {
                "smallest": smallest,
                "middle": middle,
                "largest": largest,
            },
            "volume": volume,           # mm³
            "surfaceArea": surface_area, # mm²
            "weight": {
                "grams": round(weight_g, 2),
                "kg": round(weight_kg, 4),
                "material": "6063-T5",
                "density": density,
            },
            "topology": {
                "faceCount": face_count,
                "edgeCount": edge_count,
            },
            "extrusion": {
                "isExtrusion": is_extrusion,
                "axis": extrusion_axis,
                "length": extrusion_length,
                "crossWidth": cross_width,
                "crossHeight": cross_height,
                "crossSectionArea": cross_section_area,
                "weightPerMeter": weight_per_meter,
                "isHollow": is_hollow,
                "complexity": complexity,
            },
            "pricingParams": {
                "productType": "extrusion" if is_extrusion else "plate",
                "outerWidth": round(cross_width, 2),
                "outerHeight": round(cross_height, 2),
                "length": round(extrusion_length, 2),
                "isHollow": is_hollow,
                "sectionComplexity": complexity if complexity != 'medium' else 'simple',
                "unitWeight": round(weight_kg, 4),
                "crossSectionArea": cross_section_area,
                "weightPerMeter": weight_per_meter,
            } if is_extrusion else {
                "productType": "plate",
                "width": round(cross_width, 2),
                "height": round(cross_height, 2),
                "thickness": round(smallest, 2),
                "unitWeight": round(weight_kg, 4),
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
