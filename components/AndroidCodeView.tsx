
import React from 'react';

const AndroidCodeView: React.FC = () => {
  const codeSnippets = [
    {
      title: "1. 混合布局数据结构",
      description: "在 Kotlin 中定义节点，并包含能够支撑混合布局的计算属性。",
      code: `data class Card(
    val message: String,
    val children: List<Card> = listOf(),
    var x: Float = 0f,
    var y: Float = 0f,
    var subtreeHeight: Float = 0f // 仅用于 L2+ 的纵向堆叠计算
)`
    },
    {
      title: "2. 核心递归逻辑：混合坐标系",
      description: "根据 depth 切换布局模式：depth 0 到 1 使用水平步进；depth 1 以后使用垂直偏移和水平缩进。",
      code: `fun layoutNodes(node: Card, depth: Int, startX: Float, startY: Float) {
    val cardW = 400f
    val cardH = 150f
    val hGap = 100f // L1 之间的间距
    val vStep = 80f // L2+ 的右移缩进
    val vGap = 40f  // L2+ 的垂直间距

    node.x = startX
    node.y = startY

    if (depth == 0) {
        // 第一步：Root 展开到 Level 1 (横向)
        var currentX = startX
        node.children.forEach { child ->
            layoutNodes(child, depth + 1, currentX, startY + 300f)
            currentX += cardW + hGap
        }
    } else {
        // 第二步：Level 1+ 展开到下级 (右下角阶梯)
        var nextY = startY + cardH + vGap
        node.children.forEach { child ->
            layoutNodes(child, depth + 1, startX + vStep, nextY)
            // 关键：下个兄弟节点的 Y 取决于当前子树的总高度
            nextY += calculateSubtreeHeight(child) + vGap
        }
    }
}`
    },
    {
      title: "3. 绘制 L 型折线",
      description: "在 Canvas 上通过 Path 实现右下角结构的阶梯连线。",
      code: `private fun drawStepLine(canvas: Canvas, parent: Card, child: Card, paint: Paint) {
    val path = Path().apply {
        // 从父节点底部中心稍偏左开始
        val startX = parent.x + 50f 
        val startY = parent.y + cardHeight
        val endX = child.x
        val endY = child.y + cardHeight / 2
        
        moveTo(startX, startY)
        // 垂直向下，再水平向右
        lineTo(startX, endY)
        lineTo(endX, endY)
    }
    canvas.drawPath(path, paint)
}`
    }
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12 overflow-y-auto h-full pb-32">
      <div className="space-y-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Android 混合布局算法</h2>
        <p className="text-slate-600 leading-relaxed">
          根据您的需求，我们实现了一种<strong>混合坐标计算模型</strong>：Root 节点与第一级子节点保持横向呼吸感，而从第二级开始转为紧凑的右下角阶梯排列。
        </p>
      </div>

      {codeSnippets.map((snippet, idx) => (
        <section key={idx} className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              {idx + 1}
            </span>
            <h3 className="text-xl font-bold text-slate-800">{snippet.title}</h3>
          </div>
          <p className="text-slate-600 text-sm ml-11">{snippet.description}</p>
          <div className="ml-11 bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
            <pre className="text-indigo-300 font-mono text-xs leading-5">
              <code>{snippet.code}</code>
            </pre>
          </div>
        </section>
      ))}

      <div className="ml-11 p-6 bg-emerald-50 border border-emerald-100 rounded-2xl">
        <h4 className="text-emerald-800 font-bold mb-2">算法逻辑总结</h4>
        <ul className="text-emerald-900/80 text-sm space-y-2 list-disc ml-5">
          <li><strong>条件分支布局：</strong>通过 <code>depth</code> 参数判断当前处于哪一级，从而切换 <code>x</code> 或 <code>y</code> 的累加方向。</li>
          <li><strong>阶梯式缩进：</strong>在 Level 2 及后续级别，子节点固定向右偏移一个 <code>vStep</code>，形成清晰的目录层级感。</li>
          <li><strong>自底向上高度统计：</strong>为了防止垂直方向的节点重叠，父节点在安排第二个子节点时，必须通过递归获取第一个子节点整棵子树的总高度。</li>
        </ul>
      </div>
    </div>
  );
};

export default AndroidCodeView;
