# FFU Studio 1.1.1

- Sửa lỗi `ModuleNotFoundError: No module named 'ffu'` khi chọn template hoặc xem trước font trên Windows. Bộ đọc FFU tự thêm đường dẫn tuyệt đối của thư mục `engine`, tương thích với Python nhúng trong bộ cài và bản portable.
- Kiểm tra khi khởi động nạp cả bộ đọc FFU, bộ xem trước và bộ sinh font, thay vì chỉ kiểm tra các thư viện Python.
- Chạy Python ở chế độ UTF-8 để nhật ký và dữ liệu xem trước có ký tự tiếng Việt được truyền đúng trên Windows.
- Thêm kiểm tra hồi quy chạy bộ xem trước trong chế độ Python cô lập, dùng FFU tổng hợp và đường dẫn có khoảng trắng, ký tự tiếng Việt.

Cài bản Setup 1.1.1 để nâng cấp ứng dụng đã cài, hoặc dùng Portable 1.1.1. Python và các thư viện vẫn đi kèm; không cần cài Python riêng.
