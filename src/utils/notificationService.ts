import { message, Modal, notification } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import type { NotificationInstance } from 'antd/es/notification/interface';

// Ant Design App 实例接口
interface AppInstance {
  message: MessageInstance;
  notification: NotificationInstance;
  modal: Omit<ModalStaticFunctions, 'warn'>;
}

// 通知类型
type NotificationType = 'success' | 'info' | 'warning' | 'error';

// 创建一个App实例，用于包装Modal等组件
let staticApp: AppInstance | null = null;

// 初始化方法，在应用启动时调用
const initializeApp = (appInstance: AppInstance): void => {
  staticApp = appInstance;
};

interface MessageConfig {
  content: string;
  duration?: number;
  style?: React.CSSProperties;
}

interface NotificationConfig {
  message: string;
  description?: string;
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}

interface ConfirmConfig {
  title: string;
  content: string;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
}

const defaultStyle: React.CSSProperties = {
  marginTop: '20px',
};

const notificationService = {
  // 普通提示信息
  info: (content: string, duration: number = 3): void => {
    message.info({
      content,
      duration,
      style: defaultStyle,
    });
  },

  // 成功提示
  success: (content: string, duration: number = 3): void => {
    message.success({
      content,
      duration,
      style: defaultStyle,
    });
  },

  // 警告提示
  warning: (content: string, duration: number = 3): void => {
    message.warning({
      content,
      duration,
      style: defaultStyle,
    });
  },

  // 错误提示
  error: (content: string, duration: number = 3): void => {
    message.error({
      content,
      duration,
      style: defaultStyle,
    });
  },

  // 加载中提示
  loading: (content: string, duration: number = 0): (() => void) => {
    return message.loading({
      content,
      duration,
      style: defaultStyle,
    });
  },

  // 右上角通知
  notify: (
    type: NotificationType, 
    messageText: string, 
    description?: string
  ): void => {
    notification[type]({
      message: messageText,
      description,
      placement: 'topRight',
    });
  },

  // 确认对话框
  confirm: (
    title: string,
    content: string,
    onOk?: () => void | Promise<void>,
    onCancel?: () => void
  ): void => {
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

  // 信息对话框
  info_modal: (title: string, content: string): void => {
    if (staticApp) {
      staticApp.modal.info({
        title,
        content,
        okText: '确定',
      });
    } else {
      Modal.info({
        title,
        content,
        okText: '确定',
      });
    }
  },

  // 成功对话框
  success_modal: (title: string, content: string): void => {
    if (staticApp) {
      staticApp.modal.success({
        title,
        content,
        okText: '确定',
      });
    } else {
      Modal.success({
        title,
        content,
        okText: '确定',
      });
    }
  },

  // 警告对话框
  warning_modal: (title: string, content: string): void => {
    if (staticApp) {
      staticApp.modal.warning({
        title,
        content,
        okText: '确定',
      });
    } else {
      Modal.warning({
        title,
        content,
        okText: '确定',
      });
    }
  },

  // 错误对话框
  error_modal: (title: string, content: string): void => {
    if (staticApp) {
      staticApp.modal.error({
        title,
        content,
        okText: '确定',
      });
    } else {
      Modal.error({
        title,
        content,
        okText: '确定',
      });
    }
  },
};

export { notificationService as default, initializeApp };
export type { AppInstance, NotificationType, MessageConfig, NotificationConfig, ConfirmConfig };