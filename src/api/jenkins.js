/**
 * @typedef {import('../components/Jenkins.vue').JenkinsConfig} JenkinsConfig
 */

/**
 * 创建一个 Jenkins API 客户端
 * @param {JenkinsConfig} config
 */
export function createJenkinsApi(config) {
  const { baseUrl, username, token, crumb } = config;

  /**
   * 基础 fetch 函数，处理认证和通用错误
   * @param {string} path - API 路径
   * @param {RequestInit} options - fetch 选项
   */
  async function jenkinsFetch(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = new Headers(options.headers || {});

    // 添加基础认证
    headers.set('Authorization', 'Basic ' + btoa(`${username}:${token}`));

    // 如果有 Crumb，则添加
    if (crumb) {
      headers.set('Jenkins-Crumb', crumb);
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jenkins API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Jenkins API 有些成功响应可能是空的，比如触发构建
    if (response.headers.get('content-length') === '0' || response.status === 201 || response.status === 204) {
      return null;
    }

    return response.json();
  }

  return {
    /**
     * 获取 CSRF Crumb
     */
    async getCrumb() {
      const url = `${baseUrl}/crumbIssuer/api/json`;
      const headers = {
        'Authorization': 'Basic ' + btoa(`${username}:${token}`),
      };
      const response = await fetch(url, { headers });
      if (!response.ok) {
        // 如果获取 crumb 失败，可能是 Jenkins 服务器没有开启 CSRF 保护，可以优雅地处理
        console.warn('Could not fetch Jenkins Crumb. This is fine if CSRF protection is disabled.');
        return null;
      }
      const data = await response.json();
      return data;
    },

    /**
     * 获取所有 Jobs
     */
    getJobs() {
      return jenkinsFetch('/api/json?tree=jobs[name,url,color]');
    },

    /**
     * 获取 Job 的详细信息，包括构建历史和参数定义
     * @param {string} jobName
     */
    getJob(jobName) {
      return jenkinsFetch(`/job/${jobName}/api/json?tree=builds[number,url,result,building,duration,timestamp,description,changeSet[items[msg,author[fullName]]]],actions[parameterDefinitions[*]]`);
    },

    /**
     * 获取构建的详细信息
     * @param {string} jobName
     * @param {number} buildNumber
     */
    getBuild(jobName, buildNumber) {
      return jenkinsFetch(`/job/${jobName}/${buildNumber}/api/json`);
    },

    /**
     * 停止构建
     * @param {string} jobName
     * @param {number} buildNumber
     */
    stopBuild(jobName, buildNumber) {
      return jenkinsFetch(`/job/${jobName}/${buildNumber}/stop`, { method: 'POST' });
    },

    /**
     * 触发一个没有参数的构建
     * @param {string} jobName
     */
    buildJob(jobName) {
      return jenkinsFetch(`/job/${jobName}/build`, { method: 'POST' });
    },

    /**
     * 触发一个带参数的构建
     * @param {string} jobName
     * @param {Record<string, any>} params
     */
    buildWithParams(jobName, params) {
      const formData = new FormData();
      for (const key in params) {
        formData.append(key, params[key]);
      }
      // Jenkins API 要求带参数构建时，需要一个名为 "json" 的参数
      formData.append('json', JSON.stringify(params));

      return jenkinsFetch(`/job/${jobName}/buildWithParameters`, {
        method: 'POST',
        body: new URLSearchParams(formData) // 使用 URLSearchParams 来编码表单数据
      });
    }
  };
}
