import { parentPort, workerData } from 'worker_threads'

console.log('[wcdbWorker] Worker 线程启动')

let core: any = null
let WcdbCoreClass: any = null

async function getCore() {
    if (!core) {
        try {
            console.log('[wcdbWorker] 准备动态加载 WcdbCore')

            // 使用动态 import 延迟加载
            if (!WcdbCoreClass) {
                const module = await import('./services/wcdbCore')
                WcdbCoreClass = module.WcdbCore
                console.log('[wcdbWorker] WcdbCore 类加载成功')
            }

            console.log('[wcdbWorker] 准备创建 WcdbCore 实例')
            core = new WcdbCoreClass()
            console.log('[wcdbWorker] WcdbCore 实例创建成功')
        } catch (e) {
            console.error('[wcdbWorker] 创建 WcdbCore 实例失败:', e)
            throw e
        }
    }
    return core
}

if (parentPort) {
    parentPort.on('message', async (msg) => {
        const { id, type, payload } = msg
        console.log(`[wcdbWorker] 收到消息: ${type}`)

        try {
            let result: any

            // 对于 setPaths 和 setLogEnabled，延迟到真正需要时再创建实例
            if (type === 'setPaths' || type === 'setLogEnabled') {
                console.log(`[wcdbWorker] ${type} 调用 - 暂存配置`)
                result = { success: true }
                parentPort!.postMessage({ id, result })
                return
            }

            // 健康检查：尝试加载 DLL 但不创建完整实例
            if (type === 'checkHealth') {
                console.log('[wcdbWorker] 开始健康检查')
                try {
                    // 尝试动态加载 WcdbCore 模块
                    if (!WcdbCoreClass) {
                        const module = await import('./services/wcdbCore')
                        WcdbCoreClass = module.WcdbCore
                        console.log('[wcdbWorker] WcdbCore 类加载成功')
                    }
                    // 尝试创建实例（这一步会加载 DLL）
                    const testCore = new WcdbCoreClass()
                    const initOk = await testCore.initialize()
                    if (initOk) {
                        testCore.shutdown()
                        result = { success: true, message: 'DLL 加载成功' }
                    } else {
                        const { getLastDllInitError } = await import('./services/wcdbCore')
                        const dllError = getLastDllInitError()
                        result = { success: false, error: dllError || 'DLL 初始化失败' }
                    }
                } catch (e) {
                    console.error('[wcdbWorker] 健康检查失败:', e)
                    result = { success: false, error: String(e) }
                }
                parentPort!.postMessage({ id, result })
                return
            }

            // 其他操作需要创建实例
            const coreInstance = await getCore()

            switch (type) {
                case 'testConnection':
                    console.log('[wcdbWorker] 开始执行 testConnection')
                    result = await coreInstance.testConnection(payload.dbPath, payload.hexKey, payload.wxid)
                    console.log('[wcdbWorker] testConnection 完成', result)
                    break
                case 'open':
                    result = await coreInstance.open(payload.dbPath, payload.hexKey, payload.wxid)
                    break
                case 'close':
                    coreInstance.close()
                    result = { success: true }
                    break
                case 'isConnected':
                    result = coreInstance.isConnected()
                    break
                case 'getSessions':
                    result = await coreInstance.getSessions()
                    break
                case 'getMessages':
                    result = await coreInstance.getMessages(payload.sessionId, payload.limit, payload.offset)
                    break
                case 'getNewMessages':
                    result = await coreInstance.getNewMessages(payload.sessionId, payload.minTime, payload.limit)
                    break
                case 'getMessageCount':
                    result = await coreInstance.getMessageCount(payload.sessionId)
                    break
                case 'getDisplayNames':
                    result = await coreInstance.getDisplayNames(payload.usernames)
                    break
                case 'getAvatarUrls':
                    result = await coreInstance.getAvatarUrls(payload.usernames)
                    break
                case 'getGroupMemberCount':
                    result = await coreInstance.getGroupMemberCount(payload.chatroomId)
                    break
                case 'getGroupMemberCounts':
                    result = await coreInstance.getGroupMemberCounts(payload.chatroomIds)
                    break
                case 'getGroupMembers':
                    result = await coreInstance.getGroupMembers(payload.chatroomId)
                    break
                case 'getGroupNicknames':
                    result = await coreInstance.getGroupNicknames(payload.chatroomId)
                    break
                case 'getMessageTables':
                    result = await coreInstance.getMessageTables(payload.sessionId)
                    break
                case 'getMessageTableStats':
                    result = await coreInstance.getMessageTableStats(payload.sessionId)
                    break
                case 'getMessageMeta':
                    result = await coreInstance.getMessageMeta(payload.dbPath, payload.tableName, payload.limit, payload.offset)
                    break
                case 'getContact':
                    result = await coreInstance.getContact(payload.username)
                    break
                case 'getAggregateStats':
                    result = await coreInstance.getAggregateStats(payload.sessionIds, payload.beginTimestamp, payload.endTimestamp)
                    break
                case 'getAvailableYears':
                    result = await coreInstance.getAvailableYears(payload.sessionIds)
                    break
                case 'getAnnualReportStats':
                    result = await coreInstance.getAnnualReportStats(payload.sessionIds, payload.beginTimestamp, payload.endTimestamp)
                    break
                case 'getAnnualReportExtras':
                    result = await coreInstance.getAnnualReportExtras(payload.sessionIds, payload.beginTimestamp, payload.endTimestamp, payload.peakDayBegin, payload.peakDayEnd)
                    break
                case 'getGroupStats':
                    result = await coreInstance.getGroupStats(payload.chatroomId, payload.beginTimestamp, payload.endTimestamp)
                    break
                case 'openMessageCursor':
                    result = await coreInstance.openMessageCursor(payload.sessionId, payload.batchSize, payload.ascending, payload.beginTimestamp, payload.endTimestamp)
                    break
                case 'openMessageCursorLite':
                    result = await coreInstance.openMessageCursorLite(payload.sessionId, payload.batchSize, payload.ascending, payload.beginTimestamp, payload.endTimestamp)
                    break
                case 'fetchMessageBatch':
                    result = await coreInstance.fetchMessageBatch(payload.cursor)
                    break
                case 'closeMessageCursor':
                    result = await coreInstance.closeMessageCursor(payload.cursor)
                    break
                case 'execQuery':
                    result = await coreInstance.execQuery(payload.kind, payload.path, payload.sql)
                    break
                case 'getEmoticonCdnUrl':
                    result = await coreInstance.getEmoticonCdnUrl(payload.dbPath, payload.md5)
                    break
                case 'listMessageDbs':
                    result = await coreInstance.listMessageDbs()
                    break
                case 'listMediaDbs':
                    result = await coreInstance.listMediaDbs()
                    break
                case 'getMessageById':
                    result = await coreInstance.getMessageById(payload.sessionId, payload.localId)
                    break
                case 'getVoiceData':
                    result = await coreInstance.getVoiceData(payload.sessionId, payload.createTime, payload.candidates, payload.localId, payload.svrId)
                    if (!result.success) {
                        console.error('[wcdbWorker] getVoiceData failed:', result.error)
                    }
                    break
                case 'getSnsTimeline':
                    result = await coreInstance.getSnsTimeline(payload.limit, payload.offset, payload.usernames, payload.keyword, payload.startTime, payload.endTime)
                    break
                case 'getSnsAnnualStats':
                    result = await coreInstance.getSnsAnnualStats(payload.beginTimestamp, payload.endTimestamp)
                    break
                case 'getLogs':
                    result = await coreInstance.getLogs()
                    break
                case 'verifyUser':
                    result = await coreInstance.verifyUser(payload.message, payload.hwnd)
                    break
                case 'setMonitor':
                    coreInstance.setMonitor((type: string, json: string) => {
                        parentPort!.postMessage({
                            id: -1,
                            type: 'monitor',
                            payload: { type, json }
                        })
                    })
                    result = { success: true }
                    break
                default:
                    result = { success: false, error: `Unknown method: ${type}` }
            }

            parentPort!.postMessage({ id, result })
        } catch (e) {
            console.error('[wcdbWorker] 异常:', e)
            parentPort!.postMessage({ id, error: String(e) })
        }
    })
}

console.log('[wcdbWorker] Worker 线程初始化完成')
