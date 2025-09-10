import React from 'react';
import './FileIcon.css';

const FileIcon = ({ fileType, fileName, size = 40 }) => {
  const getFileType = () => {
    if (!fileName) return 'unknown';
    
    const extension = fileName.split('.').pop().toLowerCase();
    
    // 文档类型
    if (['pdf'].includes(extension)) return 'pdf';
    if (['doc', 'docx'].includes(extension)) return 'word';
    if (['xls', 'xlsx', 'csv'].includes(extension)) return 'excel';
    if (['ppt', 'pptx'].includes(extension)) return 'powerpoint';
    
    // 文本类型
    if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'].includes(extension)) return 'code';
    if (['rtf'].includes(extension)) return 'text';
    
    // 图片类型
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) return 'image';
    
    // 视频类型
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(extension)) return 'video';
    
    // 音频类型
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension)) return 'audio';
    
    // 压缩文件
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
    
    return 'default';
  };

  const type = getFileType();
  
  const getIconContent = () => {
    switch (type) {
      case 'pdf':
        return (
          <div className="file-icon pdf">
            <div className="file-icon-corner">PDF</div>
            <div className="file-icon-content">📄</div>
          </div>
        );
      
      case 'word':
        return (
          <div className="file-icon word">
            <div className="file-icon-corner">DOC</div>
            <div className="file-icon-content">📝</div>
          </div>
        );
      
      case 'excel':
        return (
          <div className="file-icon excel">
            <div className="file-icon-corner">XLS</div>
            <div className="file-icon-content">📊</div>
          </div>
        );
      
      case 'powerpoint':
        return (
          <div className="file-icon powerpoint">
            <div className="file-icon-corner">PPT</div>
            <div className="file-icon-content">📽️</div>
          </div>
        );
      
      case 'code':
        return (
          <div className="file-icon code">
            <div className="file-icon-corner">&lt;/&gt;</div>
            <div className="file-icon-content">💻</div>
          </div>
        );
      
      case 'text':
        return (
          <div className="file-icon text">
            <div className="file-icon-corner">TXT</div>
            <div className="file-icon-content">📃</div>
          </div>
        );
      
      case 'image':
        return (
          <div className="file-icon image">
            <div className="file-icon-corner">IMG</div>
            <div className="file-icon-content">🖼️</div>
          </div>
        );
      
      case 'video':
        return (
          <div className="file-icon video">
            <div className="file-icon-corner">VID</div>
            <div className="file-icon-content">🎬</div>
          </div>
        );
      
      case 'audio':
        return (
          <div className="file-icon audio">
            <div className="file-icon-corner">AUD</div>
            <div className="file-icon-content">🎵</div>
          </div>
        );
      
      case 'archive':
        return (
          <div className="file-icon archive">
            <div className="file-icon-corner">ZIP</div>
            <div className="file-icon-content">📦</div>
          </div>
        );
      
      default:
        return (
          <div className="file-icon default">
            <div className="file-icon-corner">FILE</div>
            <div className="file-icon-content">📄</div>
          </div>
        );
    }
  };

  return (
    <div className="file-icon-wrapper" style={{ width: size, height: size }}>
      {getIconContent()}
    </div>
  );
};

export default FileIcon;