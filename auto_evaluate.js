// ==UserScript==
// @name         学生评价-自动填报（改进版）
// @namespace    https://example.com/
// @version      2.0
// @description  在学生评价页面逐题点击、大幅度随机延时，模拟手动评价
// @match        https://webvpn.cqnu.edu.cn/webvpn/*/jwglxt/xspjgl/xspj_*
// @match        https://jwglxt.cqnu.edu.cn/jwglxt/xspjgl/xspj_*
// @match        *://*/jwglxt/xspjgl/xspj_*
// @match        https://jwglxt.*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ==================== 配置参数 ====================
  const CONFIG = {
    // 评语库
    comments: [
      '老师授课认真负责，课堂气氛活跃，能够很好地调动学生的学习积极性。教学内容充实，重点突出，讲解清晰，使我受益匪浅。',
      '老师教学方法灵活多样，善于引导学生思考，注重理论与实践相结合。课堂互动频繁，能够及时解答疑问，教学效果显著。',
      '老师讲课条理清晰，深入浅出，对知识点的讲解细致到位。关心学生的学习情况，课后也能耐心解答问题，是一位优秀的老师。',
      '老师备课充分，教学态度严谨，课堂组织有序。能够结合实际案例讲解理论知识，使抽象的概念变得生动易懂，收获很大。',
      '老师专业知识扎实，讲课富有激情，能够激发学生的学习兴趣。注重培养学生的独立思考能力，教学方式深受同学们欢迎。',
      '老师治学严谨，教学经验丰富，课堂内容充实且富有启发性。善于与学生沟通交流，营造了良好的学习氛围，教学质量优秀。',
      '老师授课内容丰富，重点难点讲解透彻，课堂节奏把握得当。对学生认真负责，及时反馈学习情况，帮助我们不断进步。',
      '老师讲课生动有趣，善于运用多种教学手段辅助教学。关注每位学生的学习状态，因材施教，是一位非常敬业的好老师。',
    ],
    minDelay: 1500,      // 最小延时（毫秒）- 增加以更像人类
    maxDelay: 4000,      // 最大延时（毫秒）- 增加变化范围
    submitDelay: 4000,   // 提交前延时（毫秒）
    saveRetryTimes: 2,   // 保存重试次数（减少到2次）
    saveRetryDelay: 3000, // 保存重试延时（毫秒）- 增加间隔
    nonFullMatchCount: 0, // 统计非完全符合的数量
    targetNonFullMatch: 0, // 目标符合数量（动态设置）
    // 模拟人类的额外随机暂停概率
    randomPauseChance: 0.15, // 15%概率在操作中间随机暂停
    randomPauseMin: 500,     // 随机暂停最小时长
    randomPauseMax: 2000,    // 随机暂停最大时长
    // "符合"数量配置
    minNonFullMatch: 2,      // 最少"符合"数量
    maxNonFullMatch: 3,      // 最多"符合"数量
    // 自动切换老师
    autoSwitchTeacher: false, // 是否自动切换老师
    switchTeacherDelay: 3000, // 切换老师之间的延时（毫秒）
    // 自动提交
    autoSubmit: false, // 是否保存后自动提交
  };

  // 全局状态
  let isPaused = false;
  let isStopped = false;

  // ==================== 工具函数 ====================
  
  /**
   * 延时函数
   */
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * 获取随机延时
   */
  const getRandomDelay = () => {
    return Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) + CONFIG.minDelay;
  };

  /**
   * 获取随机评语
   */
  const getRandomComment = () => {
    return CONFIG.comments[Math.floor(Math.random() * CONFIG.comments.length)];
  };

  /**
   * 模拟人类的随机思考暂停
   */
  const maybeRandomPause = async () => {
    if (Math.random() < CONFIG.randomPauseChance) {
      const pauseTime = Math.floor(
        Math.random() * (CONFIG.randomPauseMax - CONFIG.randomPauseMin) + CONFIG.randomPauseMin
      );
      log(`模拟思考中... (${pauseTime}ms)`, 'info');
      await sleep(pauseTime);
    }
  };

  /**
   * 获取所有未评价的老师行
   */
  const getTeacherRows = () => {
    const table = document.querySelector('#tempGrid');
    if (!table) {
      log('未找到老师列表表格 #tempGrid', 'warning');
      return [];
    }
    
    // 确保获取原生 DOM 元素,避免 jQuery 包装
    const rows = Array.from(document.querySelectorAll('#tempGrid tbody tr.jqgrow'));
    
    return rows.filter(row => {
      try {
        // 确保 row 是原生 DOM 元素
        const element = row.nodeType ? row : row[0];
        if (!element || !element.querySelector) {
          return false;
        }
        
        // 查找状态列,过滤出"未评"状态的行
        const statusCell = element.querySelector('td[aria-describedby="tempGrid_tjztmc"]');
        return statusCell && statusCell.textContent.trim() === '未评';
      } catch (error) {
        log(`过滤老师行时出错: ${error.message}`, 'warning');
        return false;
      }
    });
  };

  /**
   * 点击老师行来切换评价对象
   */
  const clickTeacherRow = async (row) => {
    try {
      const teacherName = row.querySelector('td[aria-describedby="tempGrid_jzgmc"]')?.textContent.trim() || '未知老师';
      const courseName = row.querySelector('td[aria-describedby="tempGrid_kcmc"]')?.textContent.trim() || '未知课程';
      
      log(`切换到老师: ${teacherName} - ${courseName}`, 'info');
      
      // 模拟真实用户点击行
      row.dispatchEvent(new MouseEvent('mouseover', { view: window, bubbles: true, cancelable: true }));
      await sleep(100 + Math.random() * 200);
      
      row.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
      await sleep(50 + Math.random() * 100);
      
      row.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
      row.click(); // 确保触发原生点击事件
      
      row.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
      
      // 等待页面加载评价内容
      log('等待评价内容加载...', 'info');
      await sleep(2000 + Math.random() * 1000);
      
      // 检查评价内容是否已加载
      const checkLoaded = () => {
        const rows = document.querySelectorAll('tr.tr-xspj');
        return rows.length > 0;
      };
      
      // 最多等待5秒
      let waitCount = 0;
      while (!checkLoaded() && waitCount < 10) {
        await sleep(500);
        waitCount++;
      }
      
      if (checkLoaded()) {
        log(`已切换到: ${teacherName}`, 'success');
      } else {
        log('评价内容加载超时，继续尝试', 'warning');
      }
      
      return { teacherName, courseName };
    } catch (error) {
      log(`切换老师时出错: ${error.message}`, 'error');
      throw error;
    }
  };

  /**
   * 等待直到取消暂停
   */
  const waitWhilePaused = async () => {
    while (isPaused && !isStopped) {
      await sleep(100);
    }
    if (isStopped) {
      throw new Error('操作已停止');
    }
  };

  /**
   * 打印日志
   */
  const log = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      info: '[*]',
      success: '[✓]',
      error: '[!]',
      warning: '[⚠]',
    }[type] || '[*]';
    console.log(`${prefix} [${timestamp}] ${message}`);
  };

  /**
   * 显示toast提示
   */
  const showToast = (message, duration = 3000) => {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #333;
      color: #fff;
      padding: 15px 30px;
      border-radius: 5px;
      z-index: 9999;
      font-size: 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, duration);
  };

  // ==================== 主函数 ====================

  /**
   * 对单个老师进行评价（不包含提交）
   */
  async function evaluateSingleTeacher() {
    log('开始填报当前老师的评价...', 'info');
    
    try {
      // 第一步：关闭警告对话框
      log('尝试关闭警告对话框...', 'info');
      const closeBtn = document.querySelector('#btn_ok');
      if (closeBtn && closeBtn.offsetParent !== null) {
        // 模拟真实用户点击
        closeBtn.dispatchEvent(new MouseEvent('mouseover', { view: window, bubbles: true, cancelable: true }));
        await sleep(80 + Math.random() * 120);
        closeBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
        await sleep(50 + Math.random() * 80);
        closeBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
        closeBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
        await sleep(1000);
        log('警告对话框已关闭', 'success');
      }

      await waitWhilePaused();

      // 第二步：获取所有评价行
      log('查找所有评价项目...', 'info');
      // 动态计算目标"符合"数量
      CONFIG.targetNonFullMatch = Math.floor(Math.random() * (CONFIG.maxNonFullMatch - CONFIG.minNonFullMatch + 1)) + CONFIG.minNonFullMatch;
      CONFIG.nonFullMatchCount = 0;
      const rows = Array.from(document.querySelectorAll('tr.tr-xspj'));
      
      if (rows.length === 0) {
        log('未找到评价项目！请确保已进入学生评价页面', 'error');
        showToast('未找到评价项目，请检查页面');
        return;
      }
      
      log(`找到 ${rows.length} 个评价项目`, 'success');
      log(`目标: ${CONFIG.targetNonFullMatch} 个"符合"，其余为"完全符合"`, 'info');
      
      for (let i = 0; i < rows.length; i++) {
        await waitWhilePaused();
        
        // 随机模拟人类的思考暂停
        await maybeRandomPause();
        
        try {
          const row = rows[i];
          
          // 决定是否使用"符合"：只在前面的项目中随机分配2-3个
          let useFullMatch = true;
          
          if (CONFIG.nonFullMatchCount < CONFIG.targetNonFullMatch) {
            // 还没达到目标，随机决定这一项是否选"符合"
            // 剩余项目数
            const remainingItems = rows.length - i;
            const remainingNeed = CONFIG.targetNonFullMatch - CONFIG.nonFullMatchCount;
            // 概率计算：确保能分配完所需的"符合"项
            const probability = remainingNeed / remainingItems;
            if (Math.random() < probability) {
              useFullMatch = false;
              CONFIG.nonFullMatchCount++;
            }
          }
          
          let radio;
          
          if (useFullMatch) {
            radio = row.querySelector('input.radio-pjf[data-sfzd="1"]');
          } else {
            // 找到第二个选项（符合）
            const radios = Array.from(row.querySelectorAll('input.radio-pjf'));
            radio = radios.find(r => r.getAttribute('data-sfzd') === '0');
          }
          
          if (radio && !radio.checked) {
            const itemNum = i + 1;
            const optionText = useFullMatch ? '完全符合' : '符合';
            log(`项目 ${itemNum}/${rows.length}: 点击'${optionText}'...`, 'info');
            
            // 模拟真实用户交互：先触发鼠标事件，再点击
            // 1. 鼠标移入
            const mouseoverEvent = new MouseEvent('mouseover', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            radio.dispatchEvent(mouseoverEvent);
            
            await sleep(50 + Math.random() * 100); // 鼠标移动到按钮上的时间
            
            // 2. 鼠标按下
            const mousedownEvent = new MouseEvent('mousedown', {
              view: window,
              bubbles: true,
              cancelable: true,
              buttons: 1
            });
            radio.dispatchEvent(mousedownEvent);
            
            await sleep(30 + Math.random() * 70); // 按下的时间
            
            // 3. 点击
            const clickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true,
              buttons: 1
            });
            radio.dispatchEvent(clickEvent);
            
            // 4. 鼠标抬起
            const mouseupEvent = new MouseEvent('mouseup', {
              view: window,
              bubbles: true,
              cancelable: true,
              buttons: 1
            });
            radio.dispatchEvent(mouseupEvent);
            
            // 5. 触发change事件
            const changeEvent = new Event('change', { bubbles: true });
            radio.dispatchEvent(changeEvent);
            
            // 6. 鼠标移出
            const mouseoutEvent = new MouseEvent('mouseout', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            radio.dispatchEvent(mouseoutEvent);
            
            // 随机延时
            const delay = getRandomDelay();
            log(`延时 ${delay}ms...`, 'info');
            await sleep(delay);
            
            log(`项目 ${itemNum} 已完成`, 'success');
          } else if (radio && radio.checked) {
            log(`项目 ${i + 1}/${rows.length}: 已选中`, 'success');
          }
        } catch (e) {
          log(`项目 ${i + 1} 出错: ${e.message}`, 'error');
          continue;
        }
      }

      log(`本次评价: 已填写 ${CONFIG.nonFullMatchCount} 个"符合", ${rows.length - CONFIG.nonFullMatchCount} 个"完全符合"`, 'info');

      await waitWhilePaused();

      // 第四步：填写评论
      log('填写评论...', 'info');
      let textarea = document.querySelector('#pyDiv textarea');
      if (!textarea) {
        textarea = document.querySelector('textarea[name="py"]');
      }
      
      if (textarea) {
        const comment = getRandomComment();
        textarea.value = comment;
        
        // 触发input和change事件
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        log(`评论已填写: ${comment.substring(0, 30)}...`, 'success');
      } else {
        log('未找到评论文本框', 'error');
      }

      await waitWhilePaused();

      // 第五步：多次保存（避免"不使用注入方式"警告）
      log(`尝试多次保存以避免警告（共${CONFIG.saveRetryTimes}次）...`, 'info');
      const saveBtn = document.querySelector('#btn_xspj_bc');
      
      if (saveBtn) {
        for (let i = 0; i < CONFIG.saveRetryTimes; i++) {
          await waitWhilePaused();
          
          log(`第 ${i + 1}/${CONFIG.saveRetryTimes} 次保存...`, 'info');
          
          // 模拟真实用户点击保存按钮：完整的鼠标交互序列
          // 1. 鼠标移入
          const mouseoverEvent = new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          saveBtn.dispatchEvent(mouseoverEvent);
          
          await sleep(80 + Math.random() * 120); // 模拟鼠标移动到按钮的时间
          
          // 2. 鼠标按下
          const mousedownEvent = new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
          });
          saveBtn.dispatchEvent(mousedownEvent);
          
          await sleep(50 + Math.random() * 100); // 模拟按下的时间
          
          // 3. 点击事件
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
          });
          saveBtn.dispatchEvent(clickEvent);
          
          // 4. 鼠标抬起
          const mouseupEvent = new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
          });
          saveBtn.dispatchEvent(mouseupEvent);
          
          // 5. 鼠标移出
          await sleep(30 + Math.random() * 50);
          const mouseoutEvent = new MouseEvent('mouseout', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          saveBtn.dispatchEvent(mouseoutEvent);
          
          // 等待一段时间后检查并关闭弹窗
          await sleep(800);
          
          // 检查是否有警告弹窗，如果有就关闭
          let alertBtn = document.querySelector('#btn_ok');
          if (alertBtn && alertBtn.offsetParent !== null) {
            // 模拟真实点击关闭按钮
            alertBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            await sleep(50);
            alertBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
            alertBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
            log('已关闭警告弹窗', 'info');
            await sleep(500);
          }
          
          // 剩余等待时间
          await sleep(CONFIG.saveRetryDelay - 800);
          
          // 再次检查是否有新弹窗
          alertBtn = document.querySelector('#btn_ok');
          if (alertBtn && alertBtn.offsetParent !== null) {
            alertBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            await sleep(50);
            alertBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
            alertBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
            log('再次关闭警告弹窗', 'info');
            await sleep(300);
          }
        }
        log(`${CONFIG.saveRetryTimes}次保存完成`, 'success');
      } else {
        log('未找到保存按钮', 'warning');
      }

      log('当前老师评价完成（已保存）', 'success');
      
      // 第六步：自动提交（如果启用）
      if (CONFIG.autoSubmit) {
        log('准备提交评价...', 'info');
        await sleep(2000); // 等待保存完全完成
        
        const submitBtn = document.querySelector('#btn_xspj_tj');
        if (submitBtn) {
          log('点击提交按钮...', 'info');
          
          // 模拟真实用户点击提交按钮
          submitBtn.dispatchEvent(new MouseEvent('mouseover', { view: window, bubbles: true, cancelable: true }));
          await sleep(100);
          
          submitBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
          await sleep(50);
          
          submitBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
          submitBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true, buttons: 1 }));
          
          // 等待提交完成
          await sleep(2000);
          
          // 检查并关闭提交成功弹窗
          let alertBtn = document.querySelector('#btn_ok');
          if (alertBtn && alertBtn.offsetParent !== null) {
            alertBtn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            await sleep(50);
            alertBtn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
            alertBtn.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
            log('已关闭提交成功弹窗', 'success');
            await sleep(500);
          }
        } else {
          log('未找到提交按钮', 'warning');
        }
      }

    } catch (error) {
      if (error.message === '操作已停止') {
        throw error; // 向上传递停止信号
      } else {
        log(`错误: ${error.message}`, 'error');
        console.error(error);
        throw error;
      }
    } finally {
      // 重置计数器
      CONFIG.nonFullMatchCount = 0;
    }
  }

  /**
   * 查找下一个未评价的老师行
   */
  const findNextUnratedTeacher = () => {
    const rows = Array.from(document.querySelectorAll('#tempGrid tbody tr.jqgrow'));
    for (const row of rows) {
      try {
        const statusCell = row.querySelector('td[aria-describedby="tempGrid_tjztmc"]');
        if (statusCell && statusCell.textContent.trim() === '未评') {
          return row;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  };

  /**
   * 自动填报学生评价（支持多个老师）
   */
  async function autoEvaluate() {
    log('开始自动填报学生评价...', 'info');
    isStopped = false;
    isPaused = false;
    let teacherCount = 0;
    
    try {
      if (CONFIG.autoSwitchTeacher) {
        // 自动切换老师模式：逐个找到未评价老师并填报
        log('进入自动切换老师模式，将逐个检测未评价老师', 'info');
        showToast('开始自动评价...');
        
        while (!isStopped) {
          await waitWhilePaused();
          
          // 查找下一个未评价的老师
          const nextTeacher = findNextUnratedTeacher();
          if (!nextTeacher) {
            log('未找到更多未评价的老师，评价完成！', 'success');
            showToast('所有老师评价完成！', 5000);
            break;
          }
          
          teacherCount++;
          try {
            log(`\n========== 开始评价第 ${teacherCount} 位老师 ==========`, 'info');
            
            // 点击切换到该老师
            const currentTeacher = await clickTeacherRow(nextTeacher);
            showToast(`正在评价: ${currentTeacher.teacherName}`);
            
            // 评价当前老师
            await evaluateSingleTeacher();
            
            log(`========== 第 ${teacherCount} 位老师评价完成 ==========\n`, 'success');
            
            // 等待一段时间再查找下一个老师
            log(`等待 ${CONFIG.switchTeacherDelay}ms 后查找下一位老师...`, 'info');
            await sleep(CONFIG.switchTeacherDelay);
            
          } catch (teacherError) {
            log(`评价第 ${teacherCount} 位老师时出错: ${teacherError.message}`, 'error');
            console.error('老师评价错误详情:', teacherError);
            
            // 出错时等待后继续
            log('出错，2秒后继续查找下一位老师...', 'warning');
            await sleep(2000);
          }
        }
        
        if (teacherCount > 0) {
          log(`成功完成 ${teacherCount} 位老师的评价！`, 'success');
        }
        
      } else {
        // 单个老师模式
        await evaluateSingleTeacher();
        log('当前老师评价完成！', 'success');
        showToast('评价完成！');
      }

    } catch (error) {
      if (error.message === '操作已停止') {
        log('操作已被用户停止', 'warning');
        showToast('操作已停止');
      } else {
        log(`错误: ${error.message}`, 'error');
        console.error('详细错误信息:', error);
        console.error('错误堆栈:', error.stack);
        showToast(`填报过程出错: ${error.message}`, 5000);
      }
    } finally {
      isStopped = false;
      isPaused = false;
    }
  }

  // ==================== 启动脚本 ====================

  /**
   * 创建控制面板
   */
  function createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'auto-evaluate-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #fff;
      border: 2px solid #0770cd;
      border-radius: 8px;
      padding: 15px 20px;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
      min-width: 200px;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-weight: bold; margin-bottom: 10px; color: #333;';
    title.textContent = '自动评价工具';

    // 开始按钮
    const startButton = document.createElement('button');
    startButton.id = 'start-btn';
    startButton.textContent = '开始自动填报';
    startButton.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #0770cd;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      transition: background 0.3s;
      margin-bottom: 8px;
    `;
    startButton.onmouseover = () => startButton.style.background = '#0560a8';
    startButton.onmouseout = () => startButton.style.background = '#0770cd';
    startButton.onclick = async () => {
      startButton.disabled = true;
      startButton.textContent = '正在填报中...';
      pauseButton.style.display = 'block';
      stopButton.style.display = 'block';
      await autoEvaluate();
      startButton.disabled = false;
      startButton.textContent = '开始自动填报';
      pauseButton.style.display = 'none';
      stopButton.style.display = 'none';
      pauseButton.textContent = '暂停';
      isPaused = false;
    };

    // 暂停按钮
    const pauseButton = document.createElement('button');
    pauseButton.id = 'pause-btn';
    pauseButton.textContent = '暂停';
    pauseButton.style.cssText = `
      width: 48%;
      padding: 8px;
      background: #f39c12;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
      transition: background 0.3s;
      margin-right: 4%;
      display: none;
    `;
    pauseButton.onmouseover = () => pauseButton.style.background = '#e67e22';
    pauseButton.onmouseout = () => pauseButton.style.background = '#f39c12';
    pauseButton.onclick = () => {
      isPaused = !isPaused;
      if (isPaused) {
        pauseButton.textContent = '继续';
        pauseButton.style.background = '#27ae60';
        startButton.textContent = '已暂停';
        startButton.style.opacity = '0.6';
        log('操作已暂停', 'warning');
        showToast('已暂停，点击"继续"恢复');
      } else {
        pauseButton.textContent = '暂停';
        pauseButton.style.background = '#f39c12';
        startButton.textContent = '正在填报中...';
        startButton.style.opacity = '1';
        log('继续操作', 'info');
        showToast('继续执行');
      }
    };

    // 停止按钮
    const stopButton = document.createElement('button');
    stopButton.id = 'stop-btn';
    stopButton.textContent = '停止';
    stopButton.style.cssText = `
      width: 48%;
      padding: 8px;
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
      transition: background 0.3s;
      display: none;
    `;
    stopButton.onmouseover = () => stopButton.style.background = '#c0392b';
    stopButton.onmouseout = () => stopButton.style.background = '#e74c3c';
    stopButton.onclick = () => {
      isStopped = true;
      isPaused = false;
      log('操作已停止', 'warning');
      showToast('已停止');
      startButton.disabled = false;
      startButton.textContent = '开始自动填报';
      pauseButton.style.display = 'none';
      stopButton.style.display = 'none';
      pauseButton.textContent = '暂停';
    };

    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; justify-content: space-between;';
    buttonContainer.appendChild(pauseButton);
    buttonContainer.appendChild(stopButton);

    // 自动切换老师开关
    const switchTeacherContainer = document.createElement('div');
    switchTeacherContainer.style.cssText = 'margin-top: 8px; padding: 8px 0; border-top: 1px solid #e0e0e0;';
    
    const switchTeacherCheckbox = document.createElement('label');
    switchTeacherCheckbox.style.cssText = 'display: flex; align-items: center; cursor: pointer; font-size: 13px;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = CONFIG.autoSwitchTeacher;
    checkbox.style.cssText = 'margin-right: 6px; cursor: pointer;';
    checkbox.onchange = () => {
      CONFIG.autoSwitchTeacher = checkbox.checked;
      updateTeacherCount();
      log(`自动切换老师: ${CONFIG.autoSwitchTeacher ? '已开启' : '已关闭'}`, 'info');
    };
    
    const checkboxLabel = document.createElement('span');
    checkboxLabel.textContent = '自动切换评价所有老师';
    checkboxLabel.style.cssText = 'color: #333; font-weight: 500;';
    
    switchTeacherCheckbox.appendChild(checkbox);
    switchTeacherCheckbox.appendChild(checkboxLabel);
    switchTeacherContainer.appendChild(switchTeacherCheckbox);

    // 自动提交开关
    const autoSubmitContainer = document.createElement('div');
    autoSubmitContainer.style.cssText = 'margin-top: 8px; padding: 8px 0; border-top: 1px solid #e0e0e0;';
    
    const autoSubmitCheckbox = document.createElement('label');
    autoSubmitCheckbox.style.cssText = 'display: flex; align-items: center; cursor: pointer; font-size: 13px;';
    
    const submitCheckbox = document.createElement('input');
    submitCheckbox.type = 'checkbox';
    submitCheckbox.checked = CONFIG.autoSubmit;
    submitCheckbox.style.cssText = 'margin-right: 6px; cursor: pointer;';
    submitCheckbox.onchange = () => {
      CONFIG.autoSubmit = submitCheckbox.checked;
      log(`自动提交: ${CONFIG.autoSubmit ? '已开启' : '已关闭'}`, 'info');
    };
    
    const submitCheckboxLabel = document.createElement('span');
    submitCheckboxLabel.textContent = '保存后自动提交';
    submitCheckboxLabel.style.cssText = 'color: #333; font-weight: 500;';
    
    autoSubmitCheckbox.appendChild(submitCheckbox);
    autoSubmitCheckbox.appendChild(submitCheckboxLabel);
    autoSubmitContainer.appendChild(autoSubmitCheckbox);

    // "符合"数量配置
    const matchCountContainer = document.createElement('div');
    matchCountContainer.style.cssText = 'margin-top: 8px; padding: 8px 0; border-top: 1px solid #e0e0e0;';
    
    const matchCountLabel = document.createElement('div');
    matchCountLabel.textContent = '随机填写"符合"数量';
    matchCountLabel.style.cssText = 'color: #333; font-weight: 500; margin-bottom: 6px; font-size: 13px;';
    
    const matchCountInputContainer = document.createElement('div');
    matchCountInputContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 12px;';
    
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.value = CONFIG.minNonFullMatch;
    minInput.min = '0';
    minInput.max = '20';
    minInput.style.cssText = 'width: 45px; padding: 4px; border: 1px solid #ccc; border-radius: 3px;';
    minInput.onchange = () => {
      const val = parseInt(minInput.value) || CONFIG.minNonFullMatch;
      CONFIG.minNonFullMatch = Math.max(0, val);
      if (CONFIG.minNonFullMatch > CONFIG.maxNonFullMatch) {
        CONFIG.maxNonFullMatch = CONFIG.minNonFullMatch;
        maxInput.value = CONFIG.maxNonFullMatch;
      }
      minInput.value = CONFIG.minNonFullMatch;
      log(`最少"符合"数量: ${CONFIG.minNonFullMatch}`, 'info');
    };
    
    const minLabel = document.createElement('span');
    minLabel.textContent = '最少';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.value = CONFIG.maxNonFullMatch;
    maxInput.min = '0';
    maxInput.max = '20';
    maxInput.style.cssText = 'width: 45px; padding: 4px; border: 1px solid #ccc; border-radius: 3px;';
    maxInput.onchange = () => {
      const val = parseInt(maxInput.value) || CONFIG.maxNonFullMatch;
      CONFIG.maxNonFullMatch = Math.max(CONFIG.minNonFullMatch, val);
      maxInput.value = CONFIG.maxNonFullMatch;
      log(`最多"符合"数量: ${CONFIG.maxNonFullMatch}`, 'info');
    };
    
    const maxLabel = document.createElement('span');
    maxLabel.textContent = '最多';
    
    matchCountInputContainer.appendChild(minLabel);
    matchCountInputContainer.appendChild(minInput);
    matchCountInputContainer.appendChild(maxLabel);
    matchCountInputContainer.appendChild(maxInput);
    matchCountContainer.appendChild(matchCountLabel);
    matchCountContainer.appendChild(matchCountInputContainer);

    const info = document.createElement('div');
    info.style.cssText = 'font-size: 12px; color: #666; margin-top: 10px; line-height: 1.6;';
    info.innerHTML = `
      <div>延时范围: ${CONFIG.minDelay}-${CONFIG.maxDelay}ms</div>
      <div>已检测到 <span id="row-count">0</span> 个评价项</div>
      <div>评语库: ${CONFIG.comments.length} 条</div>
      <div>保存次数: ${CONFIG.saveRetryTimes} 次</div>
      <div id="teacher-count-info" style="color: #0770cd; font-weight: 500;"></div>
    `;
    
    // 更新老师数量显示
    const updateTeacherCount = () => {
      try {
        const teacherCountInfo = document.getElementById('teacher-count-info');
        if (teacherCountInfo) {
          if (CONFIG.autoSwitchTeacher) {
            teacherCountInfo.textContent = '将自动查找并评价所有未评价老师';
            teacherCountInfo.style.color = '#0770cd';
          } else {
            teacherCountInfo.textContent = '仅评价当前老师';
            teacherCountInfo.style.color = '#666';
          }
        }
      } catch (error) {
        console.error('更新老师数量时出错:', error);
      }
    };

    panel.appendChild(title);
    panel.appendChild(startButton);
    panel.appendChild(buttonContainer);
    panel.appendChild(switchTeacherContainer);
    panel.appendChild(autoSubmitContainer);
    panel.appendChild(matchCountContainer);
    panel.appendChild(info);
    document.body.appendChild(panel);

    // 更新评价项数量
    const rowCount = document.querySelectorAll('tr.tr-xspj').length;
    document.getElementById('row-count').textContent = rowCount;
    
    // 更新老师数量
    updateTeacherCount();
  }

  /**
   * 检查页面是否加载完成
   */
  function waitForPage() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        resolve();
      } else {
        document.addEventListener('DOMContentLoaded', resolve);
      }
    });
  }

  /**
   * 初始化脚本
   */
  async function init() {
    log('脚本已加载', 'success');
    await waitForPage();
    
    // 检查是否在评价页面
    const rows = document.querySelectorAll('tr.tr-xspj');
    if (rows.length === 0) {
      log('当前页面不是学生评价页面，或页面内容未加载', 'warning');
    }
    
    // 创建控制面板
    createControlPanel();
    log('控制面板已创建，点击按钮开始自动填报', 'info');
  }

  // 脚本启动
  init().catch(error => {
    log(`初始化失败: ${error.message}`, 'error');
    console.error(error);
  });

})();

