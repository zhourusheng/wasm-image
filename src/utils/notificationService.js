import { message, Modal, notification, App } from 'antd';

// 创建一个App实例，用于包装Modal等组件
let staticApp;

// 初始化方法，在应用启动时调用
const initializeApp = (appInstance) => {
  staticApp = appInstance;
};

const notificationService = {
  // 普通提示信息
  info: (content, duration = 3) => {
    message.info({
      content,
      duration,
      style: {
        marginTop: '20px',
      },
    });
  },

  // 成功提示
  success: (content, duration = 3) => {
    message.success({
      content,
      duration,
      style: {
        marginTop: '20px',
      },
    });
  },

  // 警告提示
  warning: (content, duration = 3) => {
    message.warning({
      content,
      duration,
      style: {
        marginTop: '20px',
      },
    });
  },

  // 错误提示
  error: (content, duration = 3) => {
    message.error({
      content,
      duration,
      style: {
        marginTop: '20px',
      },
    });
  },

  // 加载中提示
  loading: (content, duration = 0) => {
    return message.loading({
      content,
      duration,
      style: {
        marginTop: '20px',
      },
    });
  },

  // 右上角通知
  notify: (type, message, description) => {
    notification[type]({
      message,
      description,
      placement: 'topRight',
    });
  },

  // 确认对话框
  confirm: (title, content, onOk, onCancel) => {
    if (staticApp) {
      // 使用App实例的modal方法
      staticApp.modal.confirm({
        title,
        content,
        okText: '确定',
        cancelText: '取消',
        onOk,
        onCancel,
      });
    } else {
      // 后备方案：如果App实例不可用，仍使用静态方法
      Modal.confirm({
        title,
        content,
        okText: '确定',
        cancelText: '取消',
        onOk,
        onCancel,
      });
      console.warn('建议使用initializeApp初始化notificationService以支持动态主题');
    }
  },
};

export { notificationService as default, initializeApp }; 