import React, { useState, useRef } from 'react';
import { AppVersionInfo, UpdateMirrorSource } from '@road-gis/shared';
import { appUpdater, CURRENT_APP_VERSION } from '../services/updater.js';
import { Download, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert, Sparkles, X, RefreshCw, ExternalLink } from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  versionInfo: AppVersionInfo;
  isForceUpdate?: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  versionInfo,
  isForceUpdate = false,
  onClose
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedText, setSpeedText] = useState('');
  const [activeMirrorName, setActiveMirrorName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const handleStartUpdate = async () => {
    setDownloading(true);
    setProgress(0);
    setErrorMsg(null);
    setDownloadSuccess(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const mirrors = versionInfo.mirrors && versionInfo.mirrors.length > 0
        ? versionInfo.mirrors
        : [
            {
              id: 'direct',
              name: '官方默认源',
              url: versionInfo.download_url,
              network_type: 'OFFICIAL_DIRECT' as const
            }
          ];

      setActiveMirrorName(mirrors[0].name);

      const result = await appUpdater.downloadApk(
        mirrors,
        (percent, speed, activeMirror) => {
          setProgress(percent);
          setSpeedText(speed);
          setActiveMirrorName(activeMirror.name);
        },
        controller.signal,
        versionInfo.file_size_bytes
      );

      setDownloadSuccess(true);
      setDownloading(false);

      // 触发安装向导
      appUpdater.installApk(result.blob, `road-patrol-v${versionInfo.latest_version}.apk`);
    } catch (err: any) {
      if (err.message !== '下载已由用户取消') {
        setErrorMsg(err.message || '安装包下载失败');
      }
      setDownloading(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setDownloading(false);
    setProgress(0);
  };

  const handleExternalBrowserDownload = () => {
    const url = versionInfo.mirrors?.[1]?.url || versionInfo.download_url;
    appUpdater.installApk(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 顶部标题区 */}
        <div className="relative p-5 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border-b border-zinc-800">
          {!isForceUpdate && !downloading && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              {isForceUpdate ? <ShieldAlert className="w-6 h-6 text-red-400" /> : <Sparkles className="w-6 h-6 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white">发现新版本巡查系统</h3>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                  isForceUpdate ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {isForceUpdate ? '重要更新' : '推荐升级'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                v{CURRENT_APP_VERSION} <ArrowRight className="inline w-3 h-3 text-zinc-500 mx-1" /> v{versionInfo.latest_version}
              </p>
            </div>
          </div>
        </div>

        {/* 版本元数据与变更日志 */}
        <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">
          {/* 版本详细参数 */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-800/60 rounded-xl border border-zinc-800 text-xs text-zinc-300">
            <div>
              <span className="text-zinc-500">安装包大小：</span>
              <span className="font-semibold text-zinc-200">{versionInfo.file_size_formatted || '4.19 MB'}</span>
            </div>
            <div>
              <span className="text-zinc-500">发布时间：</span>
              <span className="font-semibold text-zinc-200">{versionInfo.publish_time ? versionInfo.publish_time.slice(0, 10) : '2026-09-07'}</span>
            </div>
          </div>

          {/* 更新日志 */}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
              <span>更新内容说明：</span>
            </div>
            <div className="bg-zinc-950/80 rounded-xl p-3.5 border border-zinc-800 space-y-2 text-sm text-zinc-300">
              {versionInfo.release_notes && versionInfo.release_notes.length > 0 ? (
                versionInfo.release_notes.map((note, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-blue-400 font-bold shrink-0">•</span>
                    <span className="leading-relaxed">{note}</span>
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 text-xs">常规性能优化与离线架构稳定性提升。</p>
              )}
            </div>
          </div>

          {/* 强制更新警告 */}
          {isForceUpdate && (
            <div className="flex items-center space-x-2 p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>本版本包含重大协议升级与巡查安全修复，请立即更新后再开始巡查。</span>
            </div>
          )}

          {/* 下载进度条与测速 */}
          {downloading && (
            <div className="p-4 bg-blue-950/30 border border-blue-800/40 rounded-xl space-y-2.5 animate-pulse-subtle">
              <div className="flex justify-between items-center text-xs">
                <span className="text-blue-300 font-medium truncate max-w-[200px]">{activeMirrorName || '高速下载中...'}</span>
                <span className="font-mono text-blue-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>实时网速：<span className="text-zinc-200 font-mono">{speedText || '测速中...'}</span></span>
                <span className="text-zinc-500">多源断点自动切换</span>
              </div>
            </div>
          )}

          {/* 下载成功提示 */}
          {downloadSuccess && (
            <div className="flex items-center space-x-2 p-3.5 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>安装包已成功下载并唤起系统安装向导！若未自动弹出，请在手机下载管理中点击安装。</span>
            </div>
          )}

          {/* 异常错误展示 */}
          {errorMsg && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs text-amber-300 space-y-1">
              <div className="font-semibold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>下载遇到问题：</span>
              </div>
              <p className="text-amber-200/90 pl-4">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* 底部按钮操作区 */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex flex-col space-y-2">
          {downloading ? (
            <button
              onClick={handleCancelDownload}
              className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>取消当前下载</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2.5">
              {!isForceUpdate && (
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-semibold text-sm transition-colors"
                >
                  稍后提醒
                </button>
              )}
              <button
                onClick={handleStartUpdate}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>{downloadSuccess ? '重新安装' : '立即更新'}</span>
              </button>
            </div>
          )}

          {/* 浏览器直接下载备选通道 */}
          <button
            onClick={handleExternalBrowserDownload}
            className="text-center text-[11px] text-zinc-400 hover:text-blue-400 transition-colors py-1 flex items-center justify-center space-x-1"
          >
            <span>遇到网络限制？使用手机浏览器直接下载 APK</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
