export class ThreadPool {
  constructor(max) {
    this.max = max > 0 ? max : 20; // 确保 max 为正数
  }

  async submitList(runnableList) {
    // 假设 runnableList 是一个 Promise 数组，或者返回 Promise 的函数数组
    // 为了简化，这里假设它是 Promise 数组。

    for (let i = 0; i < runnableList.length; i += this.max) {
      const chunk = runnableList.slice(i, i + this.max);
      // 等待当前批次中的所有 Promise 完成
      // 如果批次中任何一个 Promise 拒绝，Promise.all 就会拒绝。
      // 如果需要即使有失败也处理所有，可以使用 Promise.allSettled。
      // 考虑到原始代码使用了 Promise.race（会在第一个完成时停止），
      // Promise.all 对于批处理来说是更健壮的选择。
      try {
        await Promise.all(chunk);
      } catch (error) {
        console.error("处理线程池批次时出错:", error);
        // 根据需要，可以选择重新抛出错误，或者记录错误并继续处理下一个批次。
        // 目前选择重新抛出，表示整个列表处理失败。
        throw error;
      }
    }
    // 原始方法没有返回值，这里也保持 void。
    // 如果需要收集结果，可以在循环外部定义一个数组来收集。
  }
}
