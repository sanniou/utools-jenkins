/**
 * @typedef {import('../components/Jenkins.vue').JenkinsConfig} JenkinsConfig
 */

/**
 * 创建一个 Jenkins API 客户端
 * @param {JenkinsConfig} config - Jenkins 连接配置
 */
export function createJenkinsApi(config) {
  const baseUrl = `${config.schema}://${config.url}`;
  const { username, password, crumb } = config;

  /**
   * 基础 fetch 函数，处理认证、Crumb 和通用错误
   * @param {string} path - API 路径
   * @param {RequestInit} options - fetch 选项
   * @private
   */
  async function jenkinsFetch(path, options = {}) {
    // 关键改良 1: 对路径进行编码，防止 job 名称中包含 '/' 等特殊字符导致 URL 错误
    const url = `${baseUrl}${path}`;
    const headers = new Headers(options.headers || {});

    // 添加基础认证
    headers.set('Authorization', 'Basic ' + btoa(`${username}:${password}`));

    // 如果有 Crumb 并且是 POST 请求，则添加 Crumb Header
    if (crumb && options.method === 'POST') {
      headers.set('Jenkins-Crumb', crumb);
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jenkins API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // 对于触发构建等操作，Jenkins 返回 201 Created 且 body 为空，需要正确处理
      if (response.headers.get('content-length') === '0' || response.status === 201 || response.status === 204) {
        return null;
      }

      return response.json();
    } catch (error) {
      console.error(`Failed to fetch from Jenkins API: ${url}`, error);
      throw error; // 重新抛出错误，以便调用方可以捕获
    }
  }

  return {
    /**
     * 获取 CSRF Crumb。通常在执行任何 POST 请求（如构建、停止）之前需要调用一次。
     * @returns {Promise<{_class: string, crumb: string, crumbRequestField: string}|null>}
     */
    async getCrumb() {
      try {
        const data = await jenkinsFetch('/crumbIssuer/api/json');
        return data;
      } catch (error) {
         // 如果 Jenkins 未开启 CSRF 保护，获取 Crumb 会失败（通常是 404），这是正常现象。
        console.warn('Could not fetch Jenkins Crumb. This is fine if CSRF protection is disabled.');
        return null;
      }
    },

    /**
     * 获取所有 Jobs 及其最新构建的摘要信息。
     * 关键改良 2: 移除了 `changeSet`，因为它在顶层 Job 列表中通常不可用，会导致 API 返回不符合预期。
     * @returns {Promise<any>}
     */
    getJobsWithLatestBuild() {
      const tree = 'jobs[name,url,color,lastBuild[changeSets[items[*]],culprits[fullName],displayName,number,url,result,building,duration,timestamp]]';
      return jenkinsFetch(`/api/json?tree=${tree}`);
    },

    /**
     * 获取单个 Job 的详细信息，包括最近的构建列表和参数定义。
     * @param {string} jobName - Job 的名称 (如果在文件夹中，请使用 'folder/jobName' 格式)
     * @returns {Promise<any>}
     */
    /**
     * 获取单个 Job 的详细信息，包括最近的构建列表和参数定义。
     * 关键改良 3: 对 jobName 进行编码，以支持文件夹路径
     * 关键改良 5: 允许传入自定义的 `tree` 参数，以提高灵活性和效率。
     * @param {string} jobName - Job 的名称 (如果在文件夹中，请使用 'folder/jobName' 格式)
     * @param {string} [customTree] - 可选的 tree 参数，用于指定返回字段
     * @returns {Promise<any>}
     */
    getJob(jobName, customTree) {
      const encodedJobName = jobName.split('/').map(encodeURIComponent).join('/job/');
      const defaultTree = 'builds[number,url,result,building,duration,estimatedDuration,queueId,timestamp],property[parameterDefinitions[*]]';
      const finalTree = customTree || defaultTree;
      return jenkinsFetch(`/job/${encodedJobName}/api/json?tree=${finalTree}`);
    },

    /**
     * 获取某次具体构建的详细信息。
     * 关键改良 4: 允许传入自定义的 `tree` 参数，以提高灵活性和效率。
     * @param {string} jobName - Job 的名称
     * @param {number | 'lastBuild'} buildNumber - 构建号或 'lastBuild' 等别名
     * @param {string} [tree] - 可选的 tree 参数，用于指定返回字段
     * @returns {Promise<any>}
     */
    getBuild(jobName, buildNumber, tree) {
      const encodedJobName = jobName.split('/').map(encodeURIComponent).join('/job/');
      const path = `/job/${encodedJobName}/${buildNumber}/api/json`;
      const finalPath = tree ? `${path}?tree=${tree}` : path;
      return jenkinsFetch(finalPath);
    },

    /**
     * 停止一个正在进行的构建
     * @param {string} jobName - Job 的名称
     * @param {number} buildNumber - 构建号
     * @returns {Promise<null>}
     */
    stopBuild(jobName, buildNumber) {
      const encodedJobName = jobName.split('/').map(encodeURIComponent).join('/job/');
      return jenkinsFetch(`/job/${encodedJobName}/${buildNumber}/stop`, { method: 'POST' });
    },

    /**
     * 触发一个 Job 的构建 (可带或不带参数)
     * @param {string} jobName - Job 的名称
     * @param {Record<string, any>} [params] - 构建参数 (可选)
     * @returns {Promise<null>}
     */
    buildJob(jobName, params) {
      const encodedJobName = jobName.split('/').map(encodeURIComponent).join('/job/');
      
      if (params && Object.keys(params).length > 0) {
        // 带参数构建
        const formData = new FormData();
        // Jenkins 需要一个名为 'json' 的参数，其值为一个包含参数列表的 JSON 字符串
        const jenkinsParams = { parameter: [] };
        for (const key in params) {
            jenkinsParams.parameter.push({ name: key, value: params[key] });
        }
        formData.append('json', JSON.stringify(jenkinsParams));

        return jenkinsFetch(`/job/${encodedJobName}/buildWithParameters`, {
            method: 'POST',
            body: formData
        });
      } else {
        // 不带参数构建
        return jenkinsFetch(`/job/${encodedJobName}/build`, { method: 'POST' });
      }
    }
  };
}