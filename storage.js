/**
 * 移动端数据本地存储模块 */
const StorageManager = {
    /**
     * 保存数据到本地存储
     * @param {string} key 存储的键名
     * @param {any} value 要存储的数据（支持对象、数组等，会自动序列化为 JSON）
     * @returns {boolean} 是否保存成功
     */
    save: function(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            window.localStorage.setItem(key, serializedValue);
            return true;
        } catch (error) {
            console.error(`Storage save error for key "${key}":`, error);
            // 处理隐私模式下可能抛出的配额异常等
            return false;
        }
    },

    /**
     * 从本地存储读取数据
     * @param {string} key 存储的键名
     * @param {any} defaultValue 读取失败或不存在时的默认值
     * @returns {any} 解析后的数据或默认值
     */
    load: function(key, defaultValue = null) {
        try {
            const serializedValue = window.localStorage.getItem(key);
            if (serializedValue === null) {
                return defaultValue;
            }
            return JSON.parse(serializedValue);
        } catch (error) {
            console.error(`Storage load error for key "${key}":`, error);
            return defaultValue;
        }
    },

    /**
     * 删除指定的本地存储数据
     * @param {string} key 存储的键名
     * @returns {boolean} 是否删除成功
     */
    remove: function(key) {
        try {
            window.localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Storage remove error for key "${key}":`, error);
            return false;
        }
    },

    /**
     * 清空所有本地存储数据
     */
    clearAll: function() {
        try {
            window.localStorage.clear();
        } catch (error) {
            console.error('Storage clearAll error:', error);
        }
    }
};

window.StorageManager = StorageManager;
