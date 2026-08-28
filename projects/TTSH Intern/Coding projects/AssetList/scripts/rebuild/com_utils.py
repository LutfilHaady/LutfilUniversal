import contextlib
import win32com.client


@contextlib.contextmanager
def excel_session(visible=False):
    xl = win32com.client.Dispatch("Excel.Application")
    xl.Visible = visible
    xl.DisplayAlerts = False
    try:
        yield xl
    finally:
        xl.DisplayAlerts = False
        xl.Quit()
