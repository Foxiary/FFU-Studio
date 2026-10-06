# FFU Studio 1.1.2

- Kiểm tra GitHub Releases của `Foxiary/FFU-Studio` và chỉ thông báo khi phiên bản release ổn định mới hơn phiên bản app đang chạy.
- So sánh phiên bản theo từng số major/minor/patch; hỗ trợ tag `1.1.2` và `v1.1.2`. Bỏ qua bản nháp, bản thử nghiệm, phiên bản bằng hoặc thấp hơn; commit nguồn mới không gây thông báo.
- Banner hiển thị phiên bản mới và phiên bản đang dùng. Nút **Download release** mở trang phát hành để tải Setup hoặc portable.
- Gửi một thông báo desktop cho mỗi phiên bản mới; **Dismiss** chỉ ẩn phiên bản đã bỏ qua. Bản mới hơn vẫn được thông báo.
- Kiểm tra khi mở app, mỗi 24 giờ khi app vẫn chạy và qua nút **Check updates**. Mất mạng không cản trở việc tạo FFU.

Người dùng 1.1.1 hoặc cũ hơn cần cài 1.1.2 thủ công một lần để có cơ chế kiểm tra release. Ứng dụng không tự cài bản mới.

## FFU Studio 1.1.1

- Sửa lỗi `ModuleNotFoundError: No module named 'ffu'` khi chọn template hoặc xem trước font trên Windows. Bộ đọc FFU tự thêm đường dẫn tuyệt đối của thư mục `engine`, tương thích với Python nhúng trong bộ cài và bản portable.
- Kiểm tra khi khởi động nạp cả bộ đọc FFU, bộ xem trước và bộ sinh font, thay vì chỉ kiểm tra các thư viện Python.
- Chạy Python ở chế độ UTF-8 để nhật ký và dữ liệu xem trước có ký tự tiếng Việt được truyền đúng trên Windows.
- Thêm kiểm tra hồi quy chạy bộ xem trước trong chế độ Python cô lập, dùng FFU tổng hợp và đường dẫn có khoảng trắng, ký tự tiếng Việt.

Cài bản Setup 1.1.1 để nâng cấp ứng dụng đã cài, hoặc dùng Portable 1.1.1. Python và các thư viện vẫn đi kèm; không cần cài Python riêng.
