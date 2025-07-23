import { create } from 'zustand';
import {
  createHorizontalCollage,
  createVerticalCollage,
  createGridCollage,
  loadImagesFromFiles
} from '../utils/imageCollageUtils';

const useCollageStore = create((set, get) => ({
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
  
  // 方法
  setImages: (images) => {
    set({ images });
  },
  
  addImages: async (files) => {
    if (!files || files.length === 0) return;
    
    set({ loading: true });
    try {
      const newImages = await loadImagesFromFiles(files);
      set(state => ({
        images: [...state.images, ...newImages],
        loading: false
      }));
    } catch (error) {
      alert("加载图片失败: " + error.message);
      set({ loading: false });
    }
  },
  
  removeImage: (indexToRemove) => {
    set(state => ({
      images: state.images.filter((_, index) => index !== indexToRemove)
    }));
  },
  
  setLayout: (layout) => {
    set({ layout });
    get().generatePreview();
  },
  
  updateOptions: (newOptions) => {
    set(state => ({
      options: { ...state.options, ...newOptions }
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
      let result;
      // 从对象数组中提取ImageData
      const imageDatas = images.map(img => img.imageData);

      if (layout === 'horizontal') {
        result = createHorizontalCollage(imageDatas, options);
      } else if (layout === 'vertical') {
        result = createVerticalCollage(imageDatas, options);
      } else if (layout === 'grid') {
        result = createGridCollage(imageDatas, options);
      }
      
      set({ previewData: result, loading: false });
    } catch (error) {
      console.error("创建拼接预览失败:", error);
      alert("创建拼接预览失败: " + error.message);
      set({ loading: false });
    }
  },
  
  setInitialImage: (image) => {
    if (image) {
      set({ initialCollageImage: image, images: [image] });
    } else {
      set({ initialCollageImage: null });
    }
  },
  
  setLoading: (loading) => {
    set({ loading });
  },
  
  reset: () => {
    set({
      images: [],
      previewData: null,
      initialCollageImage: null,
      loading: false,
      layout: 'vertical',
      options: {
        gap: 10,
        backgroundColor: '#ffffff',
        columns: 2,
      }
    });
  }
}));

export default useCollageStore; 