import pytest
import uuid
from PI.FvHeader import *
from PI.Guid import *

FvBuffers = [r"unittest\Ovmf.fd", r"unittest\PEIFV.fv"]


class TestFvHeader():
    @pytest.fixture(params=FvBuffers)
    def case(self, request):
        fv_file = request.param
        with open(fv_file, "rb") as fd:
            buffer = fd.read()
        yield buffer

    def test_fvheader(self, case):
        buffer = case
        FvStart = 0
        FvHSize = 0
        i = 0
        while i < len(buffer):
            if buffer[i:i+4] == b'_FVH' and buffer[i-40:i-40+16] == ZeroGuid.bytes:
                FvStart = i - 40
                FvHSize = unpack("<H", buffer[i+8:i+10])[0]
                fvheader = EFI_FIRMWARE_VOLUME_HEADER(
                    buffer[FvStart:FvStart+FvHSize])
                assert(fvheader.ZeroVector == ZeroGuid.bytes)
                assert(fvheader.Signature == b'_FVH')
                assert (fvheader.Encode() == buffer[FvStart:FvStart+FvHSize])
                fsguid = uuid.UUID(bytes_le=fvheader.FileSystemGuid)
                # assert (fsguid == EFI_FIRMWARE_FILE_SYSTEM2_GUID or fsguid ==
                #        EFI_FIRMWARE_FILE_SYSTEM3_GUID)
                print(FvStart, fsguid)
                i += fvheader.FvLength
                continue
            i += 1
