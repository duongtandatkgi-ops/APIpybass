export default async function handler(req, res) {
    // Cho phép CORS để extension của bạn gọi thoải mái từ mọi tên miền
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ success: false, error: "Thiếu tham số 'url'" });
    }

    try {
        console.log(`Đang xử lý link: ${targetUrl}`);

        // Gửi request giả lập trình duyệt để theo dõi luồng chuyển hướng
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            redirect: 'follow'
        });

        let finalUrl = response.url;
        const html = await response.text();

        // Quét tìm đường dẫn sạch trong mã HTML nếu không chuyển hướng tự động
        const urlRegex = /https?:\/\/[^\s<>"]+/g;
        const matches = html.match(urlRegex);
        
        let destination = finalUrl;
        if (matches) {
            for (let m of matches) {
                let clean = m.replace(/["'}>,;]/g, '');
                // Lọc bỏ các tên miền rác/hệ thống
                if (!clean.includes('gtraffic') && !clean.includes('link4m') && !clean.includes('google') && !clean.includes('cloudflare') && !clean.includes('w3.org')) {
                    destination = clean;
                    break;
                }
            }
        }

        return res.status(200).json({
            success: true,
            source: targetUrl,
            destination: destination
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
