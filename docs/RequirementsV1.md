# 业务需求
1.用户弹窗输入Offer的“推广链接”、“品牌名称”、“推广国家”、“店铺或商品落地页”，作为一个Offer的基本信息
示例1（亚马逊店铺）:
- 推广链接：https://pboost.me/UKTs4I6
- 品牌名称：Reolink
- 推广国家：美国US
- 店铺或商品落地页（即Final URL）：https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA

示例2（独立站店铺）:
- Offer推广链接：https://pboost.me/xEAgQ8ec
- 品牌名称：ITEHIL
- 推广国家：德国DE
- 店铺或商品落地页（即Final URL）：https://itehil.com/

示例3（单个商品）:
- Offer推广链接：https://pboost.me/RKWwEZR9
- 品牌名称：Reolink
- 推广国家：美国US
- 店铺或商品落地页（即Final URL）：https://www.amazon.com/dp/B0B8HLXC8Y

自动生成的字段：
- offer_name，作为offer的唯一标识，格式是：[品牌名称]_[推广国家代号]_[序号]，示例：Reolink_US_01
- 推广语言：根据国家确定推广语言，比如：若推广国家是“美国US”，则推广语言就是“English”；若推广国家是“德国GE”，则推广语言就是“German”
- 店铺/产品描述：通过配置代理后真实访问“店铺或商品落地页”获取相关数据
- 其他需要的字段

2.首页新增一个列表页显示所有Offer的信息，并在每个Offer的后面显示“操作”栏，包括如下操作按钮：”一键上广告“、”一键调整CPC“

3.当用户点击”一键上广告“按钮后，弹窗显示需要在对应的Google Ads账号中上线一个新广告所需的参数和步骤

4.”一键上广告“功能应该包含：1）真实详情页数据获取 2）关键词真实搜索量查询 3）根据真实详情页数据生成headline/description/callout/sitelink

5.根据国家确定推广语言，比如：若推广国家是“美国US”，则推广语言就是“English”；若推广国家是“德国GE”，则推广语言就是“German”

6.调用Google Ads 的Keyword Planner工具来查询每个关键词在推广国家的搜索量

7.通过Google Ads API获得每个Offer关联的所有广告系列的每日表现数据

8.为了让整个系统可以正常运作，需要一个配置页面，将所有需要用户配置的信息都展现在这里，如 Google Ads API相关信息、Gemini API Key、代理URL等

9.用户输入的Offer推广链接，访问后需要经过多次重定向才能达到最终的落地页，需要从落地页的链接中截取Final URL和Final URL suffix，同时Final URL配置在Google Ads的Campaigns-Ads层级，Final URL suffix配置在Google Ads的Campaigns-Campaigns层级
- Offer推广链接：https://pboost.me/UKTs4I6
- 最终落地页：https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA?maas=maas_adg_api_588289795052186734_static_12_201&ref_=aa_maas&tag=maas&aa_campaignid=9323c24e59a532dc86f430bf18a14950&aa_adgroupid=f21dEi3q5C057CRsghsfp1PmgJ80HG83HiYmme9yASfdsR5SQ2ouyKhsXtIqmoobEo_aBn43QCYHMVkI_c&aa_creativeid=ed3fyhjAUbNxoKWV45nWjblAJoB9fmOGtWvxGVbRhBL6MYY_c
- Final URL：https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA
- Final URL suffix：maas=maas_adg_api_588289795052186734_static_12_201&ref_=aa_maas&tag=maas&aa_campaignid=9323c24e59a532dc86f430bf18a14950&aa_adgroupid=f21dEi3q5C057CRsghsfp1PmgJ80HG83HiYmme9yASfdsR5SQ2ouyKhsXtIqmoobEo_aBn43QCYHMVkI_c&aa_creativeid=ed3fyhjAUbNxoKWV45nWjblAJoB9fmOGtWvxGVbRhBL6MYY_c
注：访问“Offer推广链接”，一定要配置代理IP访问，不要降级为非代理直接访问


10.代理URL需要用户在配置页面配置Proxy_URL，并在数据爬取、获得Final URL和Final URL suffix、推广链接检测等业务场景中使用
- Proxy_URL示例：https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt
- Proxy_URL格式检查：必须包含"cc"、"ips"、"proxyType=http"、"responseType=txt"等参数，否则前端报错反馈，其中“cc=UK”代表英国，“cc=CA”代表加拿大，“cc=ROW”代表美国
- 获取代理IP：访问Proxy_URL可以获得一个代理IP（15.235.13.80:5959:com49692430-res-row-sid-867994980:Qxi9V59e3kNOW6pnRi3i），以冒号分割的4个字段分别是host、port、username、password
- 使用方法：在进行URL访问时，需要配置获取的代理IP（host、port、username、password），确保请求来自代理IP，不要降级为直连访问

11.关键词规划时，还需要通过Google搜索商品品牌词来提取“下拉词”，并调用Google Ads 的Keyword Planner工具来查询这些下拉词在推广国家的搜索量，评估是否需要推荐；关键词推荐还需要过滤掉一些购买意图不强烈的词，比如“setup”、“how to”、“free”等

12.AI广告创意生成中，Gemini使用2.5的模型，Claude Code使用4.5模型

13.每个广告系列的每日表现数据必须每日同步并存储，并在前端显示同一个Offer下所有广告系列每日数据的趋势图

14.“一键上广告”功能的部分选项的默认值，支持用户手动修改
- objective 默认是 Website traffic
- Conversion goals 默认是 Page views
- campaign type 默认是 Search
- bidding strategy 默认是 Maximize clicks
- Maximum CPC bid limit 默认是 CN¥1.2 或等值的 US$0.17
- budget 默认是对应ads账号的货币100单位，比如 CN¥100/day 或 US$100/day
- EU political ads 默认是 No

15.AI创意生成中，需要生成真实有效的callout和sitelink，可以参考Offer对应品牌的官网信息，并结合AI能力来实现

16.当用户点击“一键上广告”按钮后，可以让用户选择一次上线1-3个有差异的广告，确保后续的广告创意、关键词、ads广告等都是差异化的，且广告变体中一定要包含"品牌导向"，若用户选择1个广告，则默认就是"品牌导向"

17.在“一键上广告”流程中，在广告创意生成后，需要对生成的广告质量进行评分（满分100分），并支持用户通过点击“重新生成”按钮来多次尝试，满意后再继续后面的流程

18.评估功能完整性和用户体验：快速创建Offer、快速关联Offer和Google Ads账号，快速为Offer创建广告、快速生成广告创意、真实上线高质量广告、广告表现数据每日同步、广告表现数据大盘展现

19.增加offer投放评分功能，当用户添加一个offer后，点击操作栏的“投放分析”按钮，弹窗显示分析过程和最终评分，通过网站数据抓取、品牌词搜索量查询等功能获取相关数据，再通过AI构建一套评分系统，判断这个offer投放google ads的ROI，一定要使用真实的数据维度，且这些数据存储在相应Offer下，便于后续广告文案生成复用

20.用户管理和套餐功能，要求：
- 前端登录界面只有登录功能，没有注册功能
- 新用户的创建只能由管理员在“用户管理”页面手动创建新用户，且自动生成8-12位字母的动物名作为用户名，确保用户名唯一不重复，生成默认密码都是 auto11@20ads
- 在用户第一次登录后强制要求用户修改登录密码，管理员除外
- 用户信息保存在后端简单实用的单实例数据库中，并实现简单的每日定时数据备份，不引入额外的外部数据库
- 当用户访问有效期过期后，在登录页登录失败，且文案提醒用户购买或升级套餐
- 创建一个默认的管理员账号（用户名：autoads/密码：K$j6z!9Tq@P2w#aR），默认分配“终身买断制”套餐，且有效期到2099年12月31日
- 管理员登录后，除了可以使用所有的业务功能外，还有一个单独的用户管理页面，可以实现如下功能：创建新用户，配置套餐、调整套餐有效期、禁用用户、查看用户列表等
- 管理员登录后，新增数据库备份历史展现列表
- 增强安全措施，避免用户破解有效期的设置
- 完善多用户并发访问设计，通过user_id进行数据隔离
- 普通用户登录后，右上角需要有一个“个人中心”的功能，点击后弹窗显示“个人基本信息”、“套餐类型”和“套餐有效期”
套餐定价：
- 年卡：5999元：适合BB新人，期望在25年Q4促销季大赚一笔的个人
- 终身买断制：10999元：适合热爱BB并持续投入的个人，外加相信大师兄能力的粉丝
- 私有化部署：29999元：适合独立工作室，包含1年技术支持和有限功能定制
注释：
- 所有套餐在功能上没有区别，只是对于年卡和终身买断制，用户访问网站的有效期有所区别
- 还有一些市场推广活动，用户会获得7天/14天/30天的使用额度，也都是通过调整用户访问的有效期来实现的

21.梳理现有的广告生成/发布/数据反馈的功能，需要有一套符合KISS原则的不断迭代优化的机制，包括AI创意优化/关键词优化/预算优化/广告系列筛选等，不断提高广告的CTR/降低CPC/提升ROI
- 是否能够快速测试Offer的投放效果？
- 是否可以针对同一个Offer投放有差异化的广告，尽快筛选出表现好的广告？
- 能否基于表现好的广告数据，来不断优化AI创意生成的prompt？
- 能否不断优化策略，包括关键词、广告文案、每日预算等，不断提高CTR并降低CPC？
- 创意效果优化不需要人工反馈，而是通过投放效果的数据，借助AI进行自动化分析

22.通过context7 mcp获得Google Ads API的详细文档，获得最新最真实的访问接口，确保对于Google Ads的操作真实有效，并引入一些有利于提高广告的CTR/降低CPC/提升ROI的新功能（保持KISS原则，不需要太复杂的功能）

23.支持“批量导入Offer”功能，支持csv文件格式，并在前端提供模版文件下载

24.在数据大盘增加“风险提示”板块，并实现：
- 每日定期对用户创建的所有Offer的推广链接进行访问测试（如 https://pboost.me/UKTs4I6），记得需要配置相应国家的代理进行真实访问，若发现推广链接无法访问或访问后页面没有显示正确的品牌名等信息，则判断此推广链接失效，需要在“风险提示”板块进行提醒
- 每日定期对用户关联的Ads账号进行状态检测，若出现账号被暂停、限制投放等信息，则需要在“风险提示”板块进行提醒

25.Offer删除逻辑
- 增加对Offer“一键删除”的功能，已删除的Offer的历史数据需要保留，Offer删除后与其关联的Ads账号自动解除关联
- 增加Offer手动解除与已关联的Ads账号解除关联的功能，无关联关系的Ads账号放入闲置Ads账号列表，便于其他Offer建立关联关系，无需重复认证

26.基于你对项目的深刻理解，帮我补充/细化/完善/优化产品定位、产品目标、对外宣传的特点等，最终生成一个对外宣传的营销页面作为首页
产品定位：Google Ads快速测试和一键优化营销平台
产品目标：
- Offer的集中管理，包括Offer基本信息、Offer与Ads账号的关联等
- Offer广告的快速上线，确保高质量的广告文案
- Offer投放数据的汇总和大盘展现，快速决策，筛选出表现好的广告系列和Offer
- 积累真实的投放数据，不断优化广告文案和关键词匹配，最大化投放ROI
可用的宣传文案：
- 自动化Offer管理、广告投放、效果优化全链路，最大化提高广告投放和优化效率
- 充分利用AI，自动完成广告文案（标题/描述/摘录/链接）的生成和评分，提前确保只投放高质量的广告文案
- 利用Google Ads的Keyword Planner获取最真实的关键词自然搜索量，不再受到其他第三方平台的数据干扰
- 实现“Offer筛选-广告投放-效果优化”的增长飞轮，构建属于自己的“印钞机”组合
套餐定价：
- 年卡：5999元：适合BB新人，期望在25年Q4促销季大赚一笔的个人
- 终身买断制：10999元：适合热爱BB并持续投入的个人，外加相信大师兄能力的粉丝
- 私有化部署：29999元：适合独立工作室，包含1年技术支持和有限功能定制

27.在首页营销页面（域名是www.autoads.dev）增加一个“立即开始”的按钮，引导至登录页面，登录后进入系统（域名是app.autoads.dev）
- 只有首页营销页面可以免登录访问，在未登录状态下访问其他页面都会被强制跳转到登录页面
- 普通用户登录后，可以访问并使用全部的业务功能
- 管理员登录后，除了可以访问并使用全部的业务功能外，还可以访问管理员专属的页面，比如“用户管理”、“数据库备份历史”等

28.用户手动创建Offer或通过文件上传批量创建Offer时，可以填写产品的价格（product_price）和佣金比例（commission_payout）这2个参数，这2个是可选参数，示例如下：
- product_price：$699.00
- commission_payout：6.75%
在创建广告流程中，配置CPC处文案提醒“建议最大CPC”：
- 按照50个广告点击出一单来计算最大CPC = product_price * commission_payout / 50
注意：
- 因为product_price一般是美元单位，故计算“最大CPC”时需要根据对应Ads账号的货币单位进行汇率转换，比如按照上面的示例计算最大CPC=$699.00*6.75%/50=$0.94=¥6.68

29.优化网站的SEO信息，突出品牌特征，相关图片参考public目录

30.读取.env中的环境变量，启动本地服务，并在本地开发环境完成所有功能的真实测试，不要使用模拟功能或模拟数据，若缺少测试所需的参数，请及时提出来，我们沟通后确定，千万不要自作主张