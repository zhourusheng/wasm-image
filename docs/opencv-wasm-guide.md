# OpenCV WebAssembly 编译指南

## 前提条件
- Git
- CMake (3.10+版本)
- Python (用于Emscripten)
- 8GB+内存和足够的磁盘空间

## 安装Emscripten

```bash
# 克隆Emscripten SDK仓库
git clone https://github.com/emscripten-core/emsdk.git

# 进入克隆的目录
cd emsdk

# 安装最新版本
./emsdk install latest

# 激活已安装的版本
./emsdk activate latest

# 设置环境变量
source ./emsdk_env.sh  # 在Windows上，使用: emsdk_env.bat
```

## 下载OpenCV

```bash
# 克隆OpenCV仓库
git clone https://github.com/opencv/opencv.git
```

## 使用Emscripten构建OpenCV

### Linux/macOS 环境

```bash
# 进入OpenCV目录
cd opencv

# 创建构建目录
mkdir build_wasm
cd build_wasm

# 使用Emscripten的CMake配置构建 (单行命令)
emcmake cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DCPU_BASELINE="" -DCPU_DISPATCH="" -DWITH_IPP=OFF -DBUILD_IPP_IW=OFF -DWITH_TBB=OFF -DWITH_OPENCL=OFF -DWITH_WEBP=OFF -DBUILD_DOCS=OFF -DBUILD_PERF_TESTS=OFF -DBUILD_TESTS=OFF -DBUILD_WITH_DEBUG_INFO=OFF -DBUILD_ZLIB=ON -DBUILD_EXAMPLES=OFF -DBUILD_JAVA=OFF -DBUILD_PACKAGE=OFF -DBUILD_opencv_apps=OFF -DBUILD_opencv_gapi=OFF -DBUILD_opencv_dnn=OFF -DBUILD_opencv_ml=OFF -DBUILD_opencv_video=OFF -DBUILD_opencv_videoio=OFF -DBUILD_opencv_highgui=ON -DBUILD_opencv_calib3d=OFF -DBUILD_opencv_features2d=ON -DBUILD_opencv_flann=ON -DBUILD_opencv_objdetect=OFF -DBUILD_opencv_photo=ON -DBUILD_opencv_imgcodecs=ON -DBUILD_opencv_imgproc=ON -DBUILD_opencv_core=ON -DCMAKE_INSTALL_PREFIX=../install -DCMAKE_C_FLAGS="-s WASM=1" -DCMAKE_CXX_FLAGS="-s WASM=1" -DCMAKE_EXE_LINKER_FLAGS="-s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=['cwrap']" ..

# 构建OpenCV
emmake make -j$(nproc)  # 根据CPU核心数调整-j参数

# 安装到指定目录
emmake make install
```

### Windows PowerShell 环境

```powershell
# 进入OpenCV目录
cd opencv

# 创建构建目录
mkdir -p build_wasm
cd build_wasm

# 清理之前的缓存（如果有）
Remove-Item -Path CMakeCache.txt -Force -ErrorAction SilentlyContinue
Remove-Item -Path CMakeFiles -Recurse -Force -ErrorAction SilentlyContinue

# 使用Emscripten的CMake配置构建 (单行命令)
# 在Windows中使用Ninja构建系统代替make
emcmake cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DCPU_BASELINE="" -DCPU_DISPATCH="" -DWITH_IPP=OFF -DBUILD_IPP_IW=OFF -DWITH_TBB=OFF -DWITH_OPENCL=OFF -DWITH_WEBP=OFF -DBUILD_DOCS=OFF -DBUILD_PERF_TESTS=OFF -DBUILD_TESTS=OFF -DBUILD_WITH_DEBUG_INFO=OFF -DBUILD_ZLIB=ON -DBUILD_EXAMPLES=OFF -DBUILD_JAVA=OFF -DBUILD_PACKAGE=OFF -DBUILD_opencv_apps=OFF -DBUILD_opencv_gapi=OFF -DBUILD_opencv_dnn=OFF -DBUILD_opencv_ml=OFF -DBUILD_opencv_video=OFF -DBUILD_opencv_videoio=OFF -DBUILD_opencv_highgui=ON -DBUILD_opencv_calib3d=OFF -DBUILD_opencv_features2d=ON -DBUILD_opencv_flann=ON -DBUILD_opencv_objdetect=OFF -DBUILD_opencv_photo=ON -DBUILD_opencv_imgcodecs=ON -DBUILD_opencv_imgproc=ON -DBUILD_opencv_core=ON -DCMAKE_INSTALL_PREFIX="$((Get-Item .).parent.FullName)/install" -DCMAKE_C_FLAGS="-s WASM=1" -DCMAKE_CXX_FLAGS="-s WASM=1" -DCMAKE_EXE_LINKER_FLAGS="-s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=['cwrap']" ..

# 构建OpenCV（Windows用Ninja代替make）
emmake ninja

# 安装到指定目录（Windows用Ninja代替make）
emmake ninja install
```

## 重要配置参数说明

- **BUILD_SHARED_LIBS=OFF**: 强制构建静态库，避免WebAssembly不支持动态链接的问题
- **BUILD_ZLIB=ON**: 启用内部zlib构建，解决依赖问题
- **ALLOW_MEMORY_GROWTH=1**: 允许内存动态增长，避免大图像处理时内存不足
- **模块选择**: 只保留必要模块(core, imgproc等)，减小最终wasm文件大小

## 输出文件

成功编译后，在`install/bin`或`install/lib`目录下查找这些文件：
- `opencv.js` - JavaScript胶水代码
- `opencv.wasm` - WebAssembly二进制文件

## 与Web项目集成

1. 将输出文件复制到项目的资源目录
2. 在HTML中引入JavaScript文件：

```html
<script src="path/to/opencv.js"></script>
```

3. 等待模块初始化：

```javascript
// 检查OpenCV.js是否准备就绪
cv['onRuntimeInitialized'] = () => {
  // OpenCV.js已就绪，可以开始使用
  console.log("OpenCV.js已准备就绪");
  // 在这里编写您的代码
};
```

## 使用示例

```javascript
function processImage() {
  // 从canvas或其他地方获取图像
  let src = cv.imread('inputCanvas');
  
  // 创建目标图像
  let dst = new cv.Mat();
  
  // 应用高斯模糊
  cv.GaussianBlur(src, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
  
  // 显示结果
  cv.imshow('outputCanvas', dst);
  
  // 清理
  src.delete();
  dst.delete();
}
```

## 优化建议

- 通过禁用未使用的OpenCV模块减小模块大小
- 尽可能启用SIMD以提高性能：添加 `-s SIMD=1` 到链接标志
- 使用`-s TOTAL_MEMORY=XXXMB`设置适当的内存配置
- 对于大型应用考虑使用`-s MODULARIZE=1`选项使模块化加载

## 故障排除

- **编译错误**: 使用单行命令可以避免换行符导致的命令解析问题
- **CMake路径问题**: 在Windows上，使用PowerShell变量确保路径正确: `-DCMAKE_INSTALL_PREFIX="$((Get-Item .).parent.FullName)/install"`
- **内存错误**: 增加分配的内存，例如`-s TOTAL_MEMORY=128MB`或启用`ALLOW_MEMORY_GROWTH=1`
- **链接错误**: 确保设置了`-DBUILD_SHARED_LIBS=OFF`，WebAssembly不支持动态链接
- **第三方库错误**: 使用`-DBUILD_ZLIB=ON`等选项构建必要的依赖库
- **Windows构建系统**: Windows环境中没有内置make，请使用`-G Ninja`和`emmake ninja`来代替`emmake make`
- **线程支持**: 添加`-s USE_PTHREADS=1`，但注意浏览器兼容性
- **文件系统操作**: 包含`-s FORCE_FILESYSTEM=1` 