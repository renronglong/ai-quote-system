'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Loader2, Package } from 'lucide-react';

interface InventoryItem {
  id: number;
  product_id: number;
  quantity: number;
  warehouse_location?: string;
  batch_number?: string;
  notes?: string;
  created_at: string;
  products: {
    id: number;
    product_code: string;
    name: string;
    material: string;
    process: string;
    surface_treatment: string;
    cost_price: string;
  };
}

interface Product {
  id: number;
  product_code: string;
  name: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    warehouse_location: '',
    batch_number: '',
    notes: '',
  });

  // 加载库存列表
  const loadInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory');
      const data = await response.json();
      if (data.success) {
        setInventory(data.data);
      }
    } catch (error) {
      console.error('加载库存失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载产品列表
  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('加载产品失败:', error);
    }
  };

  useEffect(() => {
    loadInventory();
    loadProducts();
  }, []);

  // 打开新建/编辑对话框
  const handleOpenDialog = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        product_id: item.product_id.toString(),
        quantity: item.quantity.toString(),
        warehouse_location: item.warehouse_location || '',
        batch_number: item.batch_number || '',
        notes: item.notes || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        product_id: '',
        quantity: '',
        warehouse_location: '',
        batch_number: '',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  // 保存库存记录
  const handleSave = async () => {
    try {
      const url = '/api/inventory';
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem
        ? { id: editingItem.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        setDialogOpen(false);
        loadInventory();
      } else {
        alert('保存失败: ' + data.error);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  // 删除库存记录
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条库存记录吗？')) return;

    try {
      const response = await fetch(`/api/inventory?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        loadInventory();
      } else {
        alert('删除失败: ' + data.error);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">库存管理</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          新增库存
        </Button>
      </div>

      {/* 库存列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : inventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package className="w-12 h-12 mb-2 text-gray-300" />
              <p>暂无库存数据</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品编码</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>材质</TableHead>
                  <TableHead>工艺</TableHead>
                  <TableHead>表面处理</TableHead>
                  <TableHead className="text-center">库存数量</TableHead>
                  <TableHead>仓库位置</TableHead>
                  <TableHead>批次号</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.products?.product_code || '-'}
                    </TableCell>
                    <TableCell>{item.products?.name || '-'}</TableCell>
                    <TableCell>{item.products?.material || '-'}</TableCell>
                    <TableCell>{item.products?.process || '-'}</TableCell>
                    <TableCell>{item.products?.surface_treatment || '-'}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${
                        item.quantity < 10 ? 'text-red-500' : 'text-gray-900'
                      }`}>
                        {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell>{item.warehouse_location || '-'}</TableCell>
                    <TableCell>{item.batch_number || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑库存' : '新增库存'}</DialogTitle>
            <DialogDescription>
              填写库存信息，带 * 的为必填项
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>选择产品 *</Label>
              <Select
                value={formData.product_id}
                onValueChange={(value) => setFormData({ ...formData, product_id: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择产品" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.product_code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">库存数量 *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="warehouse_location">仓库位置</Label>
              <Input
                id="warehouse_location"
                value={formData.warehouse_location}
                onChange={(e) => setFormData({ ...formData, warehouse_location: e.target.value })}
                className="mt-1"
                placeholder="例如：A区-01-02"
              />
            </div>
            <div>
              <Label htmlFor="batch_number">批次号</Label>
              <Input
                id="batch_number"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
