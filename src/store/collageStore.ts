import { create } from 'zustand';
import type {
  CollageStoreState,
  CollageItem,
  ImageDataInterface,
} from '../types';
import {
  createHorizontalCollage,
  createVerticalCollage,
  createGridCollage,
  loadImagesFromFiles,
} from '../utils/imageCollageUtils';
import notificationService from '../utils/notificationService';
import { toStandardImageData } from '../types';

type CollageLayout = 'horizontal' | 'vertical' | 'grid';

interface CollageOptions {
  gap: number;
  backgroundColor: string;
  columns: number;
}

interface ImageItem {
  imageData: ImageDataInterface;
  file?: File;
  name?: string;
}

interface CollageStoreInternalState {
  // 拼接状态
  items: CollageItem[];
  selectedItemId: string | null;
  canvasSize: { width: number; height: number };
  backgroundGolor: string;

  // 内部状态
  images: ImageItem[];
  layout: CollageLayout;
  options: CollageOptions;
  previewData: ImageDataInterface | null;
  initialCollageImage: ImageItem | null;
  loading: boolean;
}

const useCollageStore = create<CollageStoreState & CollageStoreInternalState>(
  (set, get) => ({
    // Store state
    items: [],
    selectedItemId: null,
    canvasSize: { width: 800, height: 600 },
    backgroundGolor: '#ffffff',

    // 拼接状态
    images: [],
    layout: 'vertical',
    options: {
      gap: 10,
      backgroundColor: '#ffffff',
      columns: 2,
    },
    previewData: null,
    initialCollageImage: null,
    loading: false,

    // Store methods
    addItem: (imageData: ImageDataInterface) => {
      const newItem: CollageItem = {
        id: `item-${Date.now()}-${Math.random()}`,
        imageData,
        position: { x: 0, y: 0 },
        size: { width: imageData.width, height: imageData.height },
        rotation: 0,
        zIndex: get().items.length,
      };

      set(state => ({
        items: [...state.items, newItem],
      }));
    },

    removeItem: (id: string) => {
      set(state => ({
        items: state.items.filter(item => item.id !== id),
        selectedItemId:
          state.selectedItemId === id ? null : state.selectedItemId,
      }));
    },

    updateItem: (id: string, updates: Partial<CollageItem>) => {
      set(state => ({
        items: state.items.map(item =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }));
    },

    selectItem: (id: string | null) => {
      set({ selectedItemId: id });
    },

    reorderItem: (id: string, newZIndex: number) => {
      set(state => ({
        items: state.items.map(item =>
          item.id === id ? { ...item, zIndex: newZIndex } : item
        ),
      }));
    },

    setCanvasSize: (size: { width: number; height: number }) => {
      set({ canvasSize: size });
    },

    setBackgroundColor: (color: string) => {
      set({ backgroundGolor: color });
    },

    clearCanvas: () => {
      set({
        items: [],
        selectedItemId: null,
      });
    },

    exportCollage: async (): Promise<ImageDataInterface> => {
      const { items, canvasSize, backgroundGolor } = get();

      // 创建临时canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('无法获取Canvas上下文');
      }

      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;

      // 填充背景色
      ctx.fillStyle = backgroundGolor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 按z-index排序并绘制所有items
      const sortedItems = [...items].sort((a, b) => a.zIndex - b.zIndex);

      for (const item of sortedItems) {
        ctx.save();

        // 设置变换
        ctx.translate(
          item.position.x + item.size.width / 2,
          item.position.y + item.size.height / 2
        );
        ctx.rotate((item.rotation * Math.PI) / 180);

        // 创建临时ImageBitmap来绘制
        const imageBitmap = await createImageBitmap(
          toStandardImageData(item.imageData)
        );
        ctx.drawImage(
          imageBitmap,
          -item.size.width / 2,
          -item.size.height / 2,
          item.size.width,
          item.size.height
        );

        ctx.restore();
      }

      // 获取ImageData
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },

    // 内部方法
    setImages: (images: ImageItem[]) => {
      set({ images });
    },

    addImages: async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;

      set({ loading: true });
      try {
        const fileArray = Array.from(files);
        const newImages = await loadImagesFromFiles(fileArray);

        set(state => ({
          images: [...state.images, ...newImages],
          loading: false,
        }));

        // 自动添加到拼贴画布
        newImages.forEach(image => {
          get().addItem(image.imageData);
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '加载图片失败';
        notificationService.error('加载图片失败: ' + errorMessage);
        set({ loading: false });
      }
    },

    removeImage: (indexToRemove: number) => {
      set(state => ({
        images: state.images.filter((_, index) => index !== indexToRemove),
      }));
    },

    setLayout: (layout: CollageLayout) => {
      set({ layout });
      get().generatePreview();
    },

    updateOptions: (newOptions: Partial<CollageOptions>) => {
      set(state => ({
        options: { ...state.options, ...newOptions },
      }));
      get().generatePreview();
    },

    generatePreview: async () => {
      const { images, layout, options } = get();

      if (images.length === 0) {
        set({ previewData: null });
        return;
      }

      set({ loading: true });

      try {
        let result: ImageDataInterface;
        // 从对象数组中提取ImageData
        const imageDatas = images.map(img => img.imageData);

        if (layout === 'horizontal') {
          result = createHorizontalCollage(imageDatas, options);
        } else if (layout === 'vertical') {
          result = createVerticalCollage(imageDatas, options);
        } else if (layout === 'grid') {
          result = createGridCollage(imageDatas, options);
        } else {
          throw new Error(`不支持的布局类型: ${layout}`);
        }

        set({ previewData: result, loading: false });
      } catch (error) {
        console.error('创建拼接预览失败:', error);
        const errorMessage =
          error instanceof Error ? error.message : '创建拼接预览失败';
        notificationService.error('创建拼接预览失败: ' + errorMessage);
        set({ loading: false });
      }
    },

    setInitialImage: (image: ImageItem | null) => {
      if (image) {
        set({ initialCollageImage: image, images: [image] });
        get().addItem(image.imageData);
      } else {
        set({ initialCollageImage: null });
      }
    },

    setLoading: (loading: boolean) => {
      set({ loading });
    },

    reset: () => {
      set({
        items: [],
        selectedItemId: null,
        images: [],
        previewData: null,
        initialCollageImage: null,
        loading: false,
        layout: 'vertical',
        options: {
          gap: 10,
          backgroundColor: '#ffffff',
          columns: 2,
        },
      });
    },
  })
);

export default useCollageStore;
