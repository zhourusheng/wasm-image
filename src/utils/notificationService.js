import { message, Modal, notification } from 'antd';

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
    Modal.confirm({
      title,
      content,
      okText: '确定',
      cancelText: '取消',
      onOk,
      onCancel,
    });
  },
};

export default notificationService; 