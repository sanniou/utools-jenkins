/**
 * 根据 Jenkins Job 的颜色获取对应的颜色代码
 * @param {string} color - Jenkins Job 的颜色字符串
 * @returns {string} 对应的颜色代码
 */
export function getJobColor(color) {
  if (!color) return '#808080'; // 默认灰色
  if (color.includes('anime')) return '#f9d71c'; // 动画中，黄色
  if (color === 'blue') return '#67c23a'; // 成功，绿色
  if (color === 'red') return '#f56c6c'; // 失败，红色
  if (color === 'aborted') return '#909399'; // 中止，灰色
  return '#808080';
}

/**
 * 根据构建结果和是否正在构建获取 El-Tag 的类型
 * @param {string} result - 构建结果 (SUCCESS, FAILURE, ABORTED 等)
 * @param {boolean} building - 是否正在构建
 * @returns {string} El-Tag 的类型 (primary, success, danger, info, warning)
 */
export function getBuildStatusType(result, building) {
  if (building) return 'primary';
  if (result === 'SUCCESS') return 'success';
  if (result === 'FAILURE') return 'danger';
  if (result === 'ABORTED') return 'info';
  return 'warning';
}

/**
 * 根据构建结果和是否正在构建获取构建状态的文本描述
 * @param {string} result - 构建结果 (SUCCESS, FAILURE, ABORTED 等)
 * @param {boolean} building - 是否正在构建
 * @returns {string} 构建状态的文本描述
 */
export function getBuildStatusText(result, building) {
  if (building) return '构建中';
  if (result === 'SUCCESS') return '成功';
  if (result === 'FAILURE') return '失败';
  if (result === 'ABORTED') return '已中止';
  return '未知';
}

/**
 * 根据 Pipeline Stage 的状态获取 El-Tag 的类型
 * @param {string} status - Stage 状态 (SUCCESS, FAILED, ABORTED, IN_PROGRESS, etc.)
 * @returns {string} El-Tag 的类型 (primary, success, danger, info, warning)
 */
export function getStageStatusType(status) {
  switch (status) {
    case 'SUCCESS':
      return 'success';
    case 'UNSTABLE':
    case 'PAUSED_PENDING_INPUT':
      return 'warning';
    case 'FAILED':
    case 'ABORTED':
      return 'danger';
    case 'IN_PROGRESS':
      return 'primary';
    case 'SKIPPED':
    case 'NOT_EXECUTED':
      return 'info';
    default:
      return 'info';
  }
}

/**
 * 根据 Pipeline Stage 的状态获取文本描述
 * @param {string} status - Stage 状态
 * @returns {string} 文本描述
 */
export function getStageStatusText(status) {
  const statusMap = {
    'SUCCESS': '成功', 'UNSTABLE': '不稳定', 'FAILED': '失败',
    'ABORTED': '已中止', 'IN_PROGRESS': '进行中', 'PAUSED_PENDING_INPUT': '暂停',
    'SKIPPED': '已跳过', 'NOT_EXECUTED': '未执行',
  };
  return statusMap[status] || status || '未知';
}
