// 统一页脚链接，避免代码重复
document.addEventListener('DOMContentLoaded', () => {
    const footerLinks = document.getElementById('footerLinks');
    if (footerLinks) {
        footerLinks.innerHTML = `
            <a href="https://laoyaojita.taobao.com/" target="_blank" rel="noopener noreferrer">老姚淘宝店铺</a>
            <a href="https://space.bilibili.com/88685018" target="_blank" rel="noopener noreferrer">老姚B站</a>
            <a href="https://weibo.com/pengcoolboy" target="_blank" rel="noopener noreferrer">老姚微博</a>
        `;
    }
});